import unittest
from datetime import datetime, timedelta, time
from app.db.database import SessionLocal
from app.models.customer import Customer
from app.models.user import User
from app.models.membership_plan import MembershipPlan
from app.models.customer_subscription import CustomerSubscription
from app.services.subscription_service import expire_due_subscriptions, activate_due_scheduled_subscriptions
from scripts.reset_admin_password import validate_password_strength
from scripts.cron_subscriptions import run_cron


class TestCliScripts(unittest.TestCase):

    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_validate_password_strength(self):
        # Débil: corta
        ok, msg = validate_password_strength("Short1!")
        self.assertFalse(ok)
        self.assertIn("al menos 8 caracteres", msg)

        # Débil: sin mayúscula
        ok, msg = validate_password_strength("password123!")
        self.assertFalse(ok)
        self.assertIn("mayúscula", msg)

        # Débil: sin minúscula
        ok, msg = validate_password_strength("PASSWORD123!")
        self.assertFalse(ok)
        self.assertIn("minúscula", msg)

        # Débil: sin número
        ok, msg = validate_password_strength("PasswordOnly!")
        self.assertFalse(ok)
        self.assertIn("número", msg)

        # Débil: sin símbolo
        ok, msg = validate_password_strength("Password12345")
        self.assertFalse(ok)
        self.assertIn("carácter especial", msg)

        # Fuerte: cumple todos
        ok, msg = validate_password_strength("SuperAdmin.2026#")
        self.assertTrue(ok)
        self.assertEqual(msg, "OK")

    def test_expire_due_subscriptions(self):
        customer = self.db.query(Customer).first()
        plan = self.db.query(MembershipPlan).first()
        if not customer or not plan:
            return

        # Crear suscripción vencida hace 2 horas
        expired_dt = datetime.utcnow() - timedelta(hours=2)
        sub = CustomerSubscription(
            customer_id=customer.id,
            plan_id=plan.id,
            status="active",
            current_period_start=expired_dt - timedelta(days=30),
            current_period_end=expired_dt
        )
        self.db.add(sub)
        self.db.commit()
        self.db.refresh(sub)

        # Ejecutar función de expiración
        expired_list = expire_due_subscriptions(self.db)
        self.assertIn(sub.id, [s.id for s in expired_list])

        # Verificar en BD que su estado sea 'expired'
        self.db.refresh(sub)
        self.assertEqual(sub.status, "expired")

        # Limpiar
        self.db.delete(sub)
        self.db.commit()

    def test_cron_dry_run_execution(self):
        # Debe ejecutarse limpiamente sin excepciones
        try:
            run_cron(dry_run=True)
            success = True
        except Exception:
            success = False
        self.assertTrue(success)


if __name__ == "__main__":
    unittest.main()
