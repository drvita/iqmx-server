import unittest
from unittest.mock import patch
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.customer import Customer
from app.models.role import Role
from app.lib.security import create_access_token, hash_password
from app.lib.crypto import generate_secure_secret
from app.lib.redis_client import (
    save_email_verification_token,
    consume_email_verification_token,
    get_user_id_from_verification_token,
    get_redis_client,
)


class TestEmailVerificationModule(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()
        self.redis = get_redis_client()

        # Crear o asegurar rol customer
        self.customer_role = self.db.query(Role).filter(Role.name == "customer").first()
        if not self.customer_role:
            self.customer_role = Role(name="customer")
            self.db.add(self.customer_role)
            self.db.commit()
            self.db.refresh(self.customer_role)

        # Usuario no verificado
        self.test_email = "cliente_sin_verificar@empresa.com"
        existing = self.db.query(User).filter(User.email == self.test_email).first()
        if existing:
            self.db.delete(existing)
            self.db.commit()

        self.user = User(
            name="Usuario Sin Verificar",
            email=self.test_email,
            password_hash=hash_password("Password123!"),
            role_id=self.customer_role.id,
            email_verified_at=None
        )
        self.user.roles.append(self.customer_role)
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

        self.customer = Customer(
            user_id=self.user.id,
            company_name="Empresa Test No Verificada SA",
            contact_name="Usuario Sin Verificar",
            origin="web_signup",
            privacy_accepted_at=datetime.utcnow(),
            is_active=True
        )
        self.db.add(self.customer)
        self.db.commit()
        self.db.refresh(self.customer)

        token = create_access_token(data={"sub": str(self.user.id), "user_id": self.user.id, "email": self.user.email})
        self.auth_headers = {"Authorization": f"Bearer {token}"}

    def tearDown(self):
        # Limpieza en Redis
        try:
            user_key = f"user_email_verify:{self.user.id}"
            old_tok = self.redis.get(user_key)
            if old_tok:
                self.redis.delete(f"email_verify:{old_tok}")
            self.redis.delete(user_key)
        except Exception:
            pass
        self.db.close()

    def test_redis_token_lifecycle(self):
        """Verifica el ciclo de vida: guardar, previsualizar pasivamente y quemar al consumir."""
        token = generate_secure_secret(32)
        save_email_verification_token(user_id=self.user.id, token=token, ttl_seconds=300)

        # 1. Previsualización pasiva (no debe quemar el token)
        peek_user_id = get_user_id_from_verification_token(token)
        self.assertEqual(peek_user_id, self.user.id)

        # 2. Consumo atómico
        consumed_user_id = consume_email_verification_token(token)
        self.assertEqual(consumed_user_id, self.user.id)

        # 3. Intentar consumir una segunda vez (debe retornar None, token quemado)
        second_consume = consume_email_verification_token(token)
        self.assertIsNone(second_consume)

    @patch("app.services.notifications.manager.NotificationManager.notify_customer_template")
    def test_customer_registration_creates_redis_token_and_dispatches_email(self, mock_notify):
        """El registro en /portal/register debe guardar el token en Redis y despachar email de bienvenida."""
        mock_notify.return_value = {"success": True}
        reg_email = "nuevo_registro_redis@empresa.com"

        # Limpiar si existía
        prev = self.db.query(User).filter(User.email == reg_email).first()
        if prev:
            self.db.delete(prev)
            self.db.commit()

        res = self.client.post("/api/portal/auth/register", json={
            "company_name": "Nueva Empresa Redis SA",
            "contact_name": "Contacto Nuevo",
            "email": reg_email,
            "password": "PasswordSeguro123!",
            "privacy_accepted": True
        })

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("access_token", data)
        self.assertFalse(data["customer"]["email_verified"])
        self.assertIsNone(data["customer"]["email_verified_at"])

        # Verificar en base de datos
        created_user = self.db.query(User).filter(User.email == reg_email).first()
        self.assertIsNotNone(created_user)
        self.assertFalse(created_user.is_email_verified)
        self.assertIsNone(created_user.email_verified_at)

        # Verificar en Redis
        token_in_redis = self.redis.get(f"user_email_verify:{created_user.id}")
        self.assertIsNotNone(token_in_redis)
        self.assertEqual(self.redis.get(f"email_verify:{token_in_redis}"), str(created_user.id))

        # Verificar llamada a NotificationManager
        mock_notify.assert_called_once()
        kwargs = mock_notify.call_args[1]
        self.assertEqual(kwargs["to_email"], reg_email)
        self.assertIn("token=", kwargs["template_variables"]["verification_url"])

    def test_preview_email_verification_passive_endpoint(self):
        """El endpoint GET /verify-email/preview debe ser inofensivo para escáneres de correo."""
        token = generate_secure_secret(32)
        save_email_verification_token(user_id=self.user.id, token=token, ttl_seconds=300)

        res = self.client.get(f"/api/portal/auth/verify-email/preview?token={token}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["valid"])
        self.assertEqual(data["email"], self.user.email)
        self.assertIn("***", data["masked_email"])

        # Asegurar que el token sigue en Redis (no fue quemado por el GET)
        self.assertEqual(self.redis.get(f"email_verify:{token}"), str(self.user.id))

    @patch("app.services.notifications.manager.NotificationManager.notify_admins")
    def test_verify_email_post_consumes_token_and_activates_user(self, mock_notify_admins):
        """El endpoint POST /verify-email valida y consume el token efímero, actualiza PostgreSQL y notifica a admins."""
        mock_notify_admins.return_value = {"sent": 1}
        token = generate_secure_secret(32)
        save_email_verification_token(user_id=self.user.id, token=token, ttl_seconds=300)

        self.assertFalse(self.user.is_email_verified)

        # Confirmación explícita vía POST
        res = self.client.post("/api/portal/auth/verify-email", json={"token": token})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["email"], self.user.email)

        # Verificar actualización en PostgreSQL
        self.db.refresh(self.user)
        self.assertTrue(self.user.is_email_verified)
        self.assertIsNotNone(self.user.email_verified_at)

        # Verificar que el token fue quemado en Redis
        self.assertIsNone(self.redis.get(f"email_verify:{token}"))

        # Verificar que se despachó la notificación a los administradores con los datos de contacto
        mock_notify_admins.assert_called_once()
        call_kwargs = mock_notify_admins.call_args[1]
        msg = call_kwargs["message"]
        self.assertIn(str(self.user.id), msg)
        self.assertIn(self.user.email, msg)
        self.assertIn(self.customer.contact_name, msg)

        # Reintento con el mismo token debe fallar con 400 Bad Request
        res_replay = self.client.post("/api/portal/auth/verify-email", json={"token": token})
        self.assertEqual(res_replay.status_code, 400)

    @patch("app.services.notifications.manager.NotificationManager.notify_customer_template")
    def test_resend_verification_endpoint(self, mock_notify):
        """POST /resend-verification genera un nuevo token en Redis y despacha un correo."""
        mock_notify.return_value = {"success": True}

        res = self.client.post("/api/portal/auth/resend-verification", headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])

        # Verificar que hay nuevo token en Redis
        token_in_redis = self.redis.get(f"user_email_verify:{self.user.id}")
        self.assertIsNotNone(token_in_redis)

        mock_notify.assert_called_once()


if __name__ == "__main__":
    unittest.main()
