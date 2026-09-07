import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.role import Role
from app.lib.security import create_access_token, hash_password
from app.config import settings
from app.services.notifications.telegram import send_telegram_message
from app.services.notifications.mailtrap import send_mailtrap_template
from app.services.notifications.manager import NotificationManager


class TestNotificationsModule(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()

        # Crear o asegurar rol admin
        self.admin_role = self.db.query(Role).filter(Role.name == "admin").first()
        if not self.admin_role:
            self.admin_role = Role(name="admin")
            self.db.add(self.admin_role)
            self.db.commit()
            self.db.refresh(self.admin_role)

        # Crear admin de prueba
        self.test_admin = self.db.query(User).filter(User.email == "notif_admin_test@iqmx.com").first()
        if not self.test_admin:
            self.test_admin = User(
                name="Admin Notificaciones Test",
                email="notif_admin_test@iqmx.com",
                password_hash=hash_password("SuperAdminPass123!"),
                role_id=self.admin_role.id,
                telegram_chat_id="99887766"
            )
            self.test_admin.roles.append(self.admin_role)
            self.db.add(self.test_admin)
            self.db.commit()
            self.db.refresh(self.test_admin)
        else:
            self.test_admin.telegram_chat_id = "99887766"
            self.db.commit()

        token = create_access_token(data={
            "sub": str(self.test_admin.id),
            "user_id": self.test_admin.id,
            "email": self.test_admin.email,
            "role": "admin"
        })
        self.auth_headers = {"Authorization": f"Bearer {token}"}

    def tearDown(self):
        self.db.close()

    def test_telegram_send_without_token_returns_safe_dict(self):
        """Si no hay token configurado ni provisto, no debe lanzar excepción."""
        with patch("app.services.notifications.telegram.settings.TELEGRAM_BOT_TOKEN", None):
            res = send_telegram_message(chat_id="12345", text="Hola test")
            self.assertFalse(res["success"])
            self.assertEqual(res["reason"], "no_token_configured")

    @patch("httpx.Client.post")
    def test_telegram_send_success(self, mock_post):
        """Verifica que el payload y endpoint a Telegram Bot API sean correctos."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ok": True, "result": {"message_id": 101}}
        mock_post.return_value = mock_response

        res = send_telegram_message(
            chat_id="12345678",
            text="🚨 *Alerta de Prueba*",
            parse_mode="Markdown",
            bot_token="test_bot_token_123"
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["chat_id"], "12345678")

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertIn("bottest_bot_token_123/sendMessage", args[0])
        self.assertEqual(kwargs["json"]["chat_id"], "12345678")
        self.assertEqual(kwargs["json"]["text"], "🚨 *Alerta de Prueba*")
        self.assertEqual(kwargs["json"]["parse_mode"], "Markdown")

    def test_mailtrap_send_without_token_returns_safe_dict(self):
        """Si no hay token de Mailtrap configurado, debe retornar un dict seguro."""
        with patch("app.services.notifications.mailtrap.settings.MAILTRAP_API_TOKEN", None):
            res = send_mailtrap_template(
                to_email="cliente@ejemplo.com",
                template_uuid="test-uuid",
                template_variables={"user_name": "Juan"}
            )
            self.assertFalse(res["success"])
            self.assertEqual(res["reason"], "no_token_configured")

    @patch("httpx.Client.post")
    def test_mailtrap_send_with_default_sender(self, mock_post):
        """Verifica que si no se provee remitente, use los defaults de configuración."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '{"success": true}'
        mock_response.json.return_value = {"success": True}
        mock_post.return_value = mock_response

        with patch("app.services.notifications.mailtrap.settings.MAILTRAP_API_TOKEN", "mock_mailtrap_token"):
            res = send_mailtrap_template(
                to_email="cliente@ejemplo.com",
                template_uuid="tpl-12345",
                template_variables={"company": "Mi Empresa"}
            )

            self.assertTrue(res["success"])
            mock_post.assert_called_once()
            args, kwargs = mock_post.call_args
            payload = kwargs["json"]
            self.assertEqual(payload["from"]["email"], settings.MAIL_FROM_EMAIL)
            self.assertEqual(payload["from"]["name"], settings.MAIL_FROM_NAME)
            self.assertEqual(payload["to"][0]["email"], "cliente@ejemplo.com")
            self.assertEqual(payload["template_uuid"], "tpl-12345")
            self.assertEqual(payload["template_variables"]["company"], "Mi Empresa")

    @patch("httpx.Client.post")
    def test_mailtrap_send_with_custom_sender_and_department(self, mock_post):
        """Verifica que se pueda especificar departamento o remitente dinámico."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '{"success": true}'
        mock_response.json.return_value = {"success": True}
        mock_post.return_value = mock_response

        with patch("app.services.notifications.mailtrap.settings.MAILTRAP_API_TOKEN", "mock_mailtrap_token"):
            res = send_mailtrap_template(
                to_email="cliente@ejemplo.com",
                template_uuid="tpl-billing-123",
                template_variables={"amount": "$500"},
                from_email="billing@iqissmexico.com",
                from_name="Facturación IQISSMexico",
                to_name="Lic. Pedro Gómez"
            )

            self.assertTrue(res["success"])
            payload = mock_post.call_args[1]["json"]
            self.assertEqual(payload["from"]["email"], "billing@iqissmexico.com")
            self.assertEqual(payload["from"]["name"], "Facturación IQISSMexico")
            self.assertEqual(payload["to"][0]["email"], "cliente@ejemplo.com")
            self.assertEqual(payload["to"][0]["name"], "Lic. Pedro Gómez")

    @patch("app.services.notifications.manager.send_telegram_message")
    def test_notification_manager_multi_admin_dispatch(self, mock_send_telegram):
        """NotificationManager debe iterar y despachar únicamente a admins con chat_id configurado."""
        mock_send_telegram.return_value = {"success": True}

        # Creamos segundo admin con chat_id
        admin2 = self.db.query(User).filter(User.email == "notif_admin2_test@iqmx.com").first()
        if not admin2:
            admin2 = User(
                name="Admin 2 Test",
                email="notif_admin2_test@iqmx.com",
                password_hash=hash_password("Pass123!"),
                role_id=self.admin_role.id,
                telegram_chat_id="11223344"
            )
            admin2.roles.append(self.admin_role)
            self.db.add(admin2)
            self.db.commit()

        # Creamos admin SIN chat_id (debe ser ignorado en el envío)
        admin3 = self.db.query(User).filter(User.email == "notif_admin3_nochat@iqmx.com").first()
        if not admin3:
            admin3 = User(
                name="Admin 3 Sin Chat",
                email="notif_admin3_nochat@iqmx.com",
                password_hash=hash_password("Pass123!"),
                role_id=self.admin_role.id,
                telegram_chat_id=None
            )
            admin3.roles.append(self.admin_role)
            self.db.add(admin3)
            self.db.commit()

        result = NotificationManager.notify_admins(
            db=self.db,
            message="Mensaje para admins activos",
            parse_mode="Markdown"
        )

        self.assertEqual(result["status"], "completed")
        self.assertGreaterEqual(result["sent"], 2)
        # Verifica que mock_send_telegram haya sido llamado para cada chat_id
        called_chat_ids = [call[1]["chat_id"] for call in mock_send_telegram.call_args_list]
        self.assertIn("99887766", called_chat_ids)
        self.assertIn("11223344", called_chat_ids)
        self.assertNotIn(None, called_chat_ids)

    def test_notification_manager_no_admins_returns_skipped(self):
        """Si ningún admin tiene chat_id, no se envía nada y retorna skipped."""
        mock_db = MagicMock()
        # Mockeamos consulta que retorne lista vacía
        with patch.object(NotificationManager, "get_admin_telegram_chat_ids", return_value=[]):
            res = NotificationManager.notify_admins(db=mock_db, message="Aviso")
            self.assertEqual(res["status"], "skipped")
            self.assertEqual(res["sent"], 0)
            self.assertEqual(res["reason"], "no_configured_admins")

    def test_admin_notifications_api_status_endpoint(self):
        """El endpoint GET /api/admin/notifications/status debe responder con la configuración."""
        res = self.client.get("/api/admin/notifications/status", headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("telegram", data)
        self.assertIn("mailtrap", data)
        self.assertIn("configured_admins_count", data["telegram"])
        self.assertEqual(data["mailtrap"]["default_from_email"], settings.MAIL_FROM_EMAIL)
        self.assertEqual(data["mailtrap"]["default_from_name"], settings.MAIL_FROM_NAME)

    @patch("app.services.notifications.manager.NotificationManager.notify_admins")
    def test_admin_notifications_api_test_telegram(self, mock_notify_admins):
        """El endpoint POST /api/admin/notifications/test-telegram debe ejecutar la prueba."""
        mock_notify_admins.return_value = {"sent": 1, "status": "completed"}

        res = self.client.post(
            "/api/admin/notifications/test-telegram",
            headers=self.auth_headers,
            json={"message": "Mensaje de prueba API"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["sent"], 1)
        mock_notify_admins.assert_called_once()

    @patch("app.services.notifications.manager.NotificationManager.notify_customer_template")
    def test_admin_notifications_api_test_email(self, mock_notify_email):
        """El endpoint POST /api/admin/notifications/test-email debe despachar el correo con template."""
        mock_notify_email.return_value = {"success": True, "to": "cliente@test.com"}

        res = self.client.post(
            "/api/admin/notifications/test-email",
            headers=self.auth_headers,
            json={
                "to_email": "cliente@test.com",
                "template_uuid": "mock-template-uuid",
                "template_variables": {"user_name": "Test User"},
                "from_name": "Soporte IQISSMexico",
                "from_email": "soporte@iqissmexico.com"
            }
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        mock_notify_email.assert_called_once()
        kwargs = mock_notify_email.call_args[1]
    def test_admin_auth_me_returns_telegram_chat_id(self):
        """El endpoint GET /api/admin/auth/me debe incluir telegram_chat_id."""
        res = self.client.get("/api/admin/auth/me", headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["telegram_chat_id"], "99887766")

    def test_admin_auth_me_patch_updates_telegram_chat_id(self):
        """PATCH /api/admin/auth/me debe permitir actualizar telegram_chat_id del admin autenticado."""
        res = self.client.patch(
            "/api/admin/auth/me",
            headers=self.auth_headers,
            json={"telegram_chat_id": "11223344", "name": "Admin Actualizado"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["telegram_chat_id"], "11223344")
        self.assertEqual(data["name"], "Admin Actualizado")

    @patch("app.services.notifications.telegram.send_telegram_message")
    def test_admin_auth_me_test_telegram(self, mock_send_tg):
        """POST /api/admin/auth/me/test-telegram debe enviar un mensaje de prueba al chat del admin."""
        mock_send_tg.return_value = {"success": True, "chat_id": "11223344"}

        res = self.client.post("/api/admin/auth/me/test-telegram", headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        mock_send_tg.assert_called_once()

    def test_admin_users_rejects_telegram_for_non_admin_role(self):
        """La configuración de telegram_chat_id debe ser rechazada para usuarios sin rol 'admin'."""
        partner_role = self.db.query(Role).filter(Role.name == "partner").first()
        if not partner_role:
            partner_role = Role(name="partner")
            self.db.add(partner_role)
            self.db.commit()

        res = self.client.post(
            "/api/admin/users",
            headers=self.auth_headers,
            json={
                "name": "Partner Sin Telegram",
                "email": "partner_sin_tg@empresa.com",
                "password": "Password123!",
                "role": "partner",
                "telegram_chat_id": "12345678"
            }
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("solo está disponible para usuarios con rol 'admin'", res.json()["detail"])


if __name__ == "__main__":
    unittest.main()
