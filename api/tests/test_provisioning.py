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

    def test_get_crm_internal_url_and_secret_priority(self):
        from app.api.portal_crm import get_crm_internal_url_and_secret
        db = SessionLocal()
        try:
            # Con valor explícito de entorno, debe prevalecer sobre la BD
            with patch.object(settings, "CRM_PROVISION_SECRET", "custom_env_secret_key_123"):
                _, secret = get_crm_internal_url_and_secret(db)
                self.assertEqual(secret, "custom_env_secret_key_123")

            # Con el valor default, debe descifrar de la BD
            with patch.object(settings, "CRM_PROVISION_SECRET", "crm_provision_secret_key_iqmx_default"):
                _, secret = get_crm_internal_url_and_secret(db)
                # En la BD tenemos 'f3c30f6ffd217b3e0a108b62df8d4a6e1f1ba02c0df1d8887b2b0c58cbaf2f18'
                self.assertNotEqual(secret, "crm_provision_secret_key_iqmx_default")
        finally:
            db.close()

    def test_verify_product_secret_endpoint_success(self):
        from app.api.portal_crm import get_crm_internal_url_and_secret
        db = SessionLocal()
        try:
            _, active_secret = get_crm_internal_url_and_secret(db)
        finally:
            db.close()

        res = self.client.post("/api/internal/products/verify-secret", json={
            "product_slug": "crm",
            "secret": active_secret
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["ok"])
        self.assertTrue(data["valid"])
        self.assertEqual(data["product_slug"], "crm")

    def test_verify_product_secret_endpoint_invalid(self):
        res = self.client.post("/api/internal/products/verify-secret", json={
            "product_slug": "crm",
            "secret": "invalid_random_secret_token_999"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["ok"])
        self.assertFalse(data["valid"])

    def test_verify_product_secret_endpoint_matches_env_var_and_db_keys(self):
        from app.models.product import Product
        from app.lib.crypto import decrypt_token

        db = SessionLocal()
        try:
            p = db.query(Product).filter(Product.slug == "crm").first()
            db_secret = decrypt_token(p.api_secret_encrypted, settings.TOKEN_ENCRYPTION_KEY)
        finally:
            db.close()

        # 1. Con variable de entorno activa, valida la clave de entorno
        with patch.object(settings, "CRM_PROVISION_SECRET", "custom_super_secret_env_key"):
            res_env = self.client.post("/api/internal/products/verify-secret", json={
                "product_slug": "crm",
                "secret": "custom_super_secret_env_key"
            })
            self.assertEqual(res_env.status_code, 200)
            self.assertTrue(res_env.json()["valid"])

            # 2. Y al mismo tiempo también valida la clave de la BD
            res_db = self.client.post("/api/internal/products/verify-secret", json={
                "product_slug": "crm",
                "secret": db_secret
            })
            self.assertEqual(res_db.status_code, 200)
            self.assertTrue(res_db.json()["valid"])



