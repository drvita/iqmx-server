import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.customer import Customer
from app.models.whatsapp_number import WhatsAppNumber
from app.lib.security import create_access_token
from app.lib.crypto import encrypt_token
from app.config import settings

class TestAdminWabaEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()
        admin = self.db.query(User).filter(User.role.has(name="admin")).first()
        if admin:
            token = create_access_token(data={"sub": str(admin.id), "user_id": admin.id, "email": admin.email, "role": "admin"})
            self.headers = {"Authorization": f"Bearer {token}"}
        else:
            self.headers = {}

    def tearDown(self):
        self.db.close()

    def test_waba_endpoints_require_admin_auth(self):
        """Endpoints deben responder 401 si no hay token de admin."""
        res1 = self.client.get("/api/admin/crm/waba-accounts")
        self.assertEqual(res1.status_code, 401)

        res2 = self.client.get("/api/admin/crm/waba-accounts/12345/phone-numbers")
        self.assertEqual(res2.status_code, 401)

        res3 = self.client.post("/api/admin/crm/connect-waba-number", json={
            "organization_id": "test_org",
            "waba_id": "12345",
            "phone_number_id": "67890"
        })
        self.assertEqual(res3.status_code, 401)

    def test_connect_waba_number_invalid_org_returns_404(self):
        """Si la organización no existe en el CRM, retorna 404."""
        if not self.headers:
            return
        res = self.client.post("/api/admin/crm/connect-waba-number", headers=self.headers, json={
            "organization_id": "org_inexistente_99999",
            "waba_id": "1640275947060260",
            "phone_number_id": "1266449373199847",
            "token": "EAATestToken123"
        })
        self.assertEqual(res.status_code, 404)
        self.assertIn("no encontrada", res.json().get("detail", ""))

    def test_connect_waba_number_conflict_with_other_customer(self):
        """Si el número ya pertenece a otro cliente, debe rechazar con HTTP 409 Conflict."""
        if not self.headers:
            return

        customers = self.db.query(Customer).limit(2).all()
        if len(customers) < 2:
            return

        c1 = customers[0]
        c2 = customers[1]

        conflict_phone_id = "999888777666"

        existing = self.db.query(WhatsAppNumber).filter(WhatsAppNumber.phone_number_id == conflict_phone_id).first()
        if not existing:
            existing = WhatsAppNumber(
                customer_id=c1.id,
                phone_number_id=conflict_phone_id,
                waba_id="1111111",
                display_phone_number="+52 1 999 888 7776",
                verified_name="Línea Conflictiva",
                encrypted_token=encrypt_token("tok_test", settings.TOKEN_ENCRYPTION_KEY),
                status="connected"
            )
            self.db.add(existing)
            self.db.commit()

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_res = MagicMock()
            mock_res.status_code = 200
            mock_res.json.return_value = {
                "display_phone_number": "+52 1 999 888 7776",
                "verified_name": "Línea Conflictiva",
                "status": "CONNECTED"
            }
            mock_get.return_value = mock_res

            from sqlalchemy import text
            org_row = self.db.execute(
                text("SELECT id FROM crm.organization WHERE external_customer_id = :ext_id OR name = :name LIMIT 1"),
                {"ext_id": f"iqmx_cust_{c2.id}", "name": c2.company_name}
            ).fetchone()

            if org_row:
                res = self.client.post("/api/admin/crm/connect-waba-number", headers=self.headers, json={
                    "organization_id": org_row[0],
                    "waba_id": "1111111",
                    "phone_number_id": conflict_phone_id,
                    "token": "EAATestToken123"
                })
                self.assertEqual(res.status_code, 409)
                self.assertIn("ya está vinculado", res.json().get("detail", ""))

        self.db.delete(existing)
        self.db.commit()
