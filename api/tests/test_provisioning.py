import unittest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models import User, Customer, CustomerWebhook, WhatsAppNumber
from app.lib.crypto import encrypt_token
from app.config import settings

class TestProvisioning(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.email = "provision_test_user@crmtest.com"

        db = SessionLocal()
        # Limpiar datos previos
        u = db.query(User).filter(User.email == cls.email).first()
        if u:
            db.delete(u)
            db.commit()

        # Registrar usuario
        reg_payload = {
            "company_name": "CRM Provision Corp",
            "contact_name": "Carlos Tester",
            "email": cls.email,
            "phone": "+523311223344",
            "password": "PasswordTest123!",
            "privacy_accepted": True
        }
        res = cls.client.post("/api/portal/auth/register", json=reg_payload)
        assert res.status_code == 200, f"Error setup register: {res.text}"
        cls.token = res.json()["access_token"]
        cls.customer_id = res.json()["customer"]["id"]

        # Insertar una línea de WhatsApp simulada
        encrypted_token = encrypt_token("EAAG_mock_permanent_token_xyz123", settings.TOKEN_ENCRYPTION_KEY)
        number = WhatsAppNumber(
            customer_id=cls.customer_id,
            phone_number_id="998877665544332",
            waba_id="112233445566778",
            display_phone_number="+52 1 33 1122 3344",
            verified_name="CRM Provision Corp Oficial",
            encrypted_token=encrypted_token,
            status="connected"
        )
        db.add(number)
        db.commit()
        db.refresh(number)
        cls.number_id = number.id
        db.close()

    def test_update_provision_url(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        prov_url = "https://httpbin.org/anything/provision"
        
        res = self.client.post(
            "/api/portal/webhook/config",
            json={"provision_url": prov_url, "url": "https://httpbin.org/anything/webhook", "is_active": True},
            headers=headers
        )
        self.assertEqual(res.status_code, 200, f"Error: {res.text}")
        data = res.json()
        self.assertEqual(data["provision_url"], prov_url)

        # Verificar GET
        res_get = self.client.get("/api/portal/webhook/config", headers=headers)
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(res_get.json()["provision_url"], prov_url)

    def test_get_number_credentials_decrypted(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        res = self.client.get(f"/api/portal/whatsapp/numbers/{self.number_id}/credentials", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["token"], "EAAG_mock_permanent_token_xyz123")
        self.assertEqual(data["phone_number_id"], "998877665544332")
        self.assertEqual(data["waba_id"], "112233445566778")

    @patch("app.api.portal_whatsapp.httpx.AsyncClient.post")
    def test_manual_provision_success(self, mock_post):
        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"ok": True, "message": "Línea de WhatsApp aprovisionada exitosamente en el CRM"}
        mock_resp.text = "OK"
        mock_post.return_value = mock_resp

        headers = {"Authorization": f"Bearer {self.token}"}
        self.client.post(
            "/api/portal/webhook/config",
            json={"provision_url": "https://httpbin.org/anything/provision", "url": "https://httpbin.org/anything/webhook", "is_active": True},
            headers=headers
        )

        res = self.client.post(f"/api/portal/whatsapp/numbers/{self.number_id}/provision", headers=headers)
        self.assertEqual(res.status_code, 200, f"Error: {res.text}")
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["status_code"], 200)
