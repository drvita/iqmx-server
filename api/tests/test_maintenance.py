import unittest
from datetime import datetime, timedelta
from app.db.database import SessionLocal
from app.models.user import User
from app.models.event import Event
from app.lib.redis_client import get_redis_client, save_email_verification_token
from app.services.maintenance_service import (
    cleanup_ephemeral_verification_tokens,
    cleanup_old_webhook_events,
    run_system_maintenance,
)
from scripts.cron_system_cleanup import run_cleanup


class TestSystemMaintenance(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.r = get_redis_client()

    def tearDown(self):
        self.db.close()

    def test_cleanup_ephemeral_verification_tokens_dry_run_and_real(self):
        """Verifica que se detecten y purguen tokens de usuarios ya verificados y huérfanos."""
        now = datetime.utcnow()
        timestamp = int(now.timestamp())

        # 1. Usuario A: NO verificado (su token NO debe purgarse)
        user_unverified = User(
            name="Unverified User",
            email=f"maint_unver_{timestamp}@test.com",
            password_hash="hash",
            email_verified_at=None
        )
        # 2. Usuario B: YA verificado (su token residual SÍ debe purgarse)
        user_verified = User(
            name="Verified User",
            email=f"maint_ver_{timestamp}@test.com",
            password_hash="hash",
            email_verified_at=now
        )
        self.db.add_all([user_unverified, user_verified])
        self.db.commit()

        token_unver = f"token_unver_{timestamp}"
        token_ver = f"token_ver_{timestamp}"
        token_orphan = f"token_orphan_{timestamp}"

        # Guardar en Redis
        save_email_verification_token(user_unverified.id, token_unver, ttl_seconds=3600)
        save_email_verification_token(user_verified.id, token_ver, ttl_seconds=3600)

        # Crear clave huérfana manualmente
        self.r.set(f"email_verify:{token_orphan}", "999999", ex=3600)

        # Probar modo simulación (dry-run)
        summary_dry = cleanup_ephemeral_verification_tokens(self.db, dry_run=True)
        self.assertTrue(summary_dry["dry_run"])
        self.assertGreaterEqual(summary_dry["total_purged"], 2)  # verified + orphan
        # En Redis las claves aún deben existir
        self.assertTrue(self.r.exists(f"email_verify:{token_ver}"))
        self.assertTrue(self.r.exists(f"email_verify:{token_unver}"))

        # Probar modo real
        summary_real = cleanup_ephemeral_verification_tokens(self.db, dry_run=False)
        self.assertFalse(summary_real["dry_run"])
        self.assertGreaterEqual(summary_real["purged_already_verified"], 1)
        self.assertGreaterEqual(summary_real["purged_nonexistent_user"], 1)

        # En Redis: token_ver y token_orphan fueron eliminados
        self.assertFalse(self.r.exists(f"email_verify:{token_ver}"))
        self.assertFalse(self.r.exists(f"email_verify:{token_orphan}"))

        # token_unver sigue vigente e intacto
        self.assertTrue(self.r.exists(f"email_verify:{token_unver}"))

        # Limpieza posterior
        self.r.delete(f"email_verify:{token_unver}", f"user_email_verify:{user_unverified.id}")

    def test_cleanup_old_webhook_events(self):
        """Verifica que se purguen eventos exitosos >30d y fallidos >60d sin tocar los recientes."""
        now = datetime.utcnow()

        # 1. Evento entregado hace 40 días (debe purgarse)
        ev_old_success = Event(
            payload={"test": "old_delivered"},
            delivery_status="delivered",
            created_at=now - timedelta(days=40)
        )
        # 2. Evento entregado hace 5 días (debe preservarse)
        ev_recent_success = Event(
            payload={"test": "recent_delivered"},
            delivery_status="delivered",
            created_at=now - timedelta(days=5)
        )
        # 3. Evento fallido hace 70 días (debe purgarse)
        ev_old_failed = Event(
            payload={"test": "old_failed"},
            delivery_status="failed",
            created_at=now - timedelta(days=70)
        )
        # 4. Evento fallido hace 15 días (debe preservarse)
        ev_recent_failed = Event(
            payload={"test": "recent_failed"},
            delivery_status="failed",
            created_at=now - timedelta(days=15)
        )
        self.db.add_all([ev_old_success, ev_recent_success, ev_old_failed, ev_recent_failed])
        self.db.commit()

        old_success_id = ev_old_success.id
        old_failed_id = ev_old_failed.id
        recent_success_id = ev_recent_success.id
        recent_failed_id = ev_recent_failed.id

        # Dry run
        dry_res = cleanup_old_webhook_events(self.db, days_successful=30, days_failed=60, dry_run=True)
        self.assertGreaterEqual(dry_res["purged_successful"], 1)
        self.assertGreaterEqual(dry_res["purged_failed"], 1)

        # Modo real
        real_res = cleanup_old_webhook_events(self.db, days_successful=30, days_failed=60, dry_run=False)
        self.assertGreaterEqual(real_res["total_purged"], 2)

        # Validar persistencia por ID
        self.assertIsNone(self.db.query(Event).filter(Event.id == old_success_id).first())
        self.assertIsNone(self.db.query(Event).filter(Event.id == old_failed_id).first())
        self.assertIsNotNone(self.db.query(Event).filter(Event.id == recent_success_id).first())
        self.assertIsNotNone(self.db.query(Event).filter(Event.id == recent_failed_id).first())

    def test_run_cleanup_cli_script(self):
        """Verifica que el script ejecutor run_cleanup funcione sin excepciones."""
        run_cleanup(dry_run=True)
        run_cleanup(dry_run=False)


if __name__ == "__main__":
    unittest.main()
