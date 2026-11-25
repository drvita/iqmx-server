import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.models import User, Role, Customer, ForumThread
from app.lib.security import create_access_token, hash_password
from app.services.customers import is_placeholder_email, normalize_phone


class TestManualCustomers(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()
        admin_role = self.db.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
            admin_role = Role(name="admin")
            self.db.add(admin_role)
            self.db.commit()
            self.db.refresh(admin_role)

        admin = (
            self.db.query(User)
            .filter(User.email == "admin_manual_test@iqmx.com")
            .first()
        )
        if not admin:
            admin = User(
                name="Admin Manual Test",
                email="admin_manual_test@iqmx.com",
                password_hash=hash_password("AdminPass123!"),
                role_id=admin_role.id,
            )
            admin.roles.append(admin_role)
            self.db.add(admin)
            self.db.commit()
            self.db.refresh(admin)

        self.admin = admin
        self.admin_headers = {
            "Authorization": f"Bearer {create_access_token({'sub': str(admin.id), 'user_id': admin.id, 'email': admin.email, 'role': 'admin'})}"
        }
        self._cleanup_test_records()

    def tearDown(self):
        self._cleanup_test_records()
        self.db.close()

    def _cleanup_test_records(self):
        emails = [
            "fisico_email@empresa.com",
            "fisico_claim@empresa.com",
            "fisico_phone_claim@empresa.com",
            "otro_correo@empresa.com",
            "fisico_suspendido@empresa.com",
            "cuenta_a@empresa.com",
            "cuenta_b@empresa.com",
            "fisico_foro@empresa.com",
        ]
        users = self.db.query(User).filter(User.email.in_(emails)).all()
        for u in users:
            self.db.delete(u)
        phones = ["3149998801", "3149998802", "3149998803", "3149998804", "3149998805", "3149998806"]
        custs = self.db.query(Customer).filter(Customer.phone_normalized.in_(phones)).all()
        for c in custs:
            if c.user:
                self.db.delete(c.user)
            else:
                self.db.delete(c)
        self.db.commit()

    def test_phone_normalization(self):
        self.assertEqual(normalize_phone("+52 314 123 4567"), "3141234567")
        self.assertEqual(normalize_phone("5213141234567"), "3141234567")
        self.assertEqual(normalize_phone("(314) 123-4567"), "3141234567")
        self.assertIsNone(normalize_phone("123"))

    def test_create_manual_customer_variants_and_duplicates(self):
        # 1. Rechazar si falta correo y teléfono
        res_empty = self.client.post(
            "/api/admin/customers",
            headers=self.admin_headers,
            json={
                "company_name": "Sin Contacto SA",
                "contact_name": "Juan",
                "forum_enabled": True,
            },
        )
        self.assertEqual(res_empty.status_code, 422)

        # 2. Alta manual solo con teléfono (genera correo placeholder)
        res_phone_only = self.client.post(
            "/api/admin/customers",
            headers=self.admin_headers,
            json={
                "company_name": "Ferretería Física SA",
                "contact_name": "Carlos Ruiz",
                "phone": "+52 314 999 8801",
                "forum_enabled": True,
            },
        )
        self.assertEqual(res_phone_only.status_code, 201, res_phone_only.text)
        data1 = res_phone_only.json()
        self.assertEqual(data1["origin"], "direct_sales")
        self.assertFalse(data1["has_password"])
        self.assertFalse(data1["has_real_email"])
        self.assertTrue(data1["forum_enabled"])
        self.assertTrue(is_placeholder_email(data1["email"]))

        # 3. Duplicado por teléfono con distinto formato -> 409
        res_dup_phone = self.client.post(
            "/api/admin/customers",
            headers=self.admin_headers,
            json={
                "company_name": "Otra Empresa",
                "contact_name": "Pedro",
                "phone": "5213149998801",
            },
        )
        self.assertEqual(res_dup_phone.status_code, 409)

        # 4. Alta manual con correo y teléfono
        res_full = self.client.post(
            "/api/admin/customers",
            headers=self.admin_headers,
            json={
                "company_name": "Taller Central",
                "contact_name": "Ana López",
                "email": "fisico_email@empresa.com",
                "phone": "3149998802",
                "tax_id": "TCE010101AAA",
                "forum_enabled": True,
            },
        )
        self.assertEqual(res_full.status_code, 201, res_full.text)
        data2 = res_full.json()
        self.assertTrue(data2["has_real_email"])
        self.assertFalse(data2["has_password"])

        # 5. Duplicado por correo -> 409
        res_dup_email = self.client.post(
            "/api/admin/customers",
            headers=self.admin_headers,
            json={
                "company_name": "Taller Duplicado",
                "contact_name": "Ana",
                "email": "fisico_email@empresa.com",
            },
        )
        self.assertEqual(res_dup_email.status_code, 409)

    def test_unclaimed_customer_cannot_login_or_reset_password(self):
        res = self.client.post(
            "/api/admin/customers",
            headers=self.admin_headers,
            json={
                "company_name": "Sin Password SA",
                "contact_name": "Luis",
                "email": "fisico_claim@empresa.com",
                "phone": "3149998803",
            },
        )
        self.assertEqual(res.status_code, 201)

        res_login = self.client.post(
            "/api/portal/auth/login",
            json={"email": "fisico_claim@empresa.com", "password": "Cualquiera123!"},
        )
        self.assertEqual(res_login.status_code, 401)

        with patch("app.api.portal_auth.save_password_reset_token") as mock_save:
            res_forgot = self.client.post(
                "/api/portal/auth/forgot-password",
                json={"email": "fisico_claim@empresa.com"},
            )
            self.assertEqual(res_forgot.status_code, 200)
            mock_save.assert_not_called()

    def test_register_claims_existing_customer_by_email_and_phone_without_duplicating(self):
        # Caso A: Pre-registro con email, luego se registra con el mismo email
        res_a = self.client.post(
            "/api/admin/customers",
            headers=self.admin_headers,
            json={
                "company_name": "Empresa Foro SA",
                "contact_name": "Mario",
                "email": "fisico_claim@empresa.com",
                "forum_enabled": True,
            },
        )
        self.assertEqual(res_a.status_code, 201)
        cust_id_a = res_a.json()["id"]

        res_reg_a = self.client.post(
            "/api/portal/auth/register",
            json={
                "company_name": "Empresa Foro Nueva",
                "contact_name": "Mario García",
                "email": "fisico_claim@empresa.com",
                "phone": "3149998804",
                "password": "Password123!",
                "privacy_accepted": True,
            },
        )
        self.assertEqual(res_reg_a.status_code, 200, res_reg_a.text)
        self.assertEqual(res_reg_a.json()["customer"]["id"], cust_id_a)
        self.assertEqual(res_reg_a.json()["customer"]["company_name"], "Empresa Foro SA")

        # Login ahora funciona
        res_login = self.client.post(
            "/api/portal/auth/login",
            json={"email": "fisico_claim@empresa.com", "password": "Password123!"},
        )
        self.assertEqual(res_login.status_code, 200)

        # Caso B: Pre-registro solo con teléfono, luego se registra con el mismo teléfono (otro formato) y nuevo correo
        res_b = self.client.post(
            "/api/admin/customers",
            headers=self.admin_headers,
            json={
                "company_name": "Consultorio Pacífico",
                "contact_name": "Dra. Sofía",
                "phone": "+52 314 999 8805",
                "forum_enabled": True,
            },
        )
        self.assertEqual(res_b.status_code, 201)
        cust_id_b = res_b.json()["id"]

        res_reg_b = self.client.post(
            "/api/portal/auth/register",
            json={
                "company_name": "Consultorio Pacífico",
                "contact_name": "Dra. Sofía",
                "email": "fisico_phone_claim@empresa.com",
                "phone": "3149998805",
                "password": "Password123!",
                "privacy_accepted": True,
            },
        )
        self.assertEqual(res_reg_b.status_code, 200, res_reg_b.text)
        self.assertEqual(res_reg_b.json()["customer"]["id"], cust_id_b)
        self.assertEqual(res_reg_b.json()["customer"]["email"], "fisico_phone_claim@empresa.com")

    def test_security_account_takeover_and_suspended_blocks(self):
        # 1. Pre-registro con email real + teléfono -> intento de reclamar por teléfono con otro email => 409
        res = self.client.post(
            "/api/admin/customers",
            headers=self.admin_headers,
            json={
                "company_name": "Protegida SA",
                "contact_name": "Elena",
                "email": "cuenta_a@empresa.com",
                "phone": "3149998806",
            },
        )
        self.assertEqual(res.status_code, 201)

        res_hijack = self.client.post(
            "/api/portal/auth/register",
            json={
                "company_name": "Atacante SA",
                "contact_name": "Atacante",
                "email": "otro_correo@empresa.com",
                "phone": "+52 314 999 8806",
                "password": "Password123!",
                "privacy_accepted": True,
            },
        )
        self.assertEqual(res_hijack.status_code, 409)

        # 2. Cliente suspendido pre-registrado -> intento de registro => 403
        res_susp = self.client.post(
            "/api/admin/customers",
            headers=self.admin_headers,
            json={
                "company_name": "Suspendida SA",
                "contact_name": "Roberto",
                "email": "fisico_suspendido@empresa.com",
            },
        )
        self.assertEqual(res_susp.status_code, 201)
        susp_id = res_susp.json()["id"]
        self.client.patch(
            f"/api/admin/customers/{susp_id}/status",
            headers=self.admin_headers,
            json={"is_active": False},
        )

        res_reg_susp = self.client.post(
            "/api/portal/auth/register",
            json={
                "company_name": "Suspendida SA",
                "contact_name": "Roberto",
                "email": "fisico_suspendido@empresa.com",
                "password": "Password123!",
                "privacy_accepted": True,
            },
        )
        self.assertEqual(res_reg_susp.status_code, 403)

    def test_forum_integration_preserves_threads_after_claim(self):
        res_cust = self.client.post(
            "/api/admin/customers",
            headers=self.admin_headers,
            json={
                "company_name": "Cliente Foro Físico",
                "contact_name": "Jorge",
                "email": "fisico_foro@empresa.com",
                "forum_enabled": True,
            },
        )
        self.assertEqual(res_cust.status_code, 201)
        cust_id = res_cust.json()["id"]

        res_thread = self.client.post(
            "/api/admin/forum/threads",
            headers=self.admin_headers,
            json={
                "customer_id": cust_id,
                "title": "Implementación física inicial",
                "body": "Seguimiento de cliente físico en foro.",
            },
        )
        self.assertEqual(res_thread.status_code, 201, res_thread.text)
        thread_id = res_thread.json()["id"]

        res_reg = self.client.post(
            "/api/portal/auth/register",
            json={
                "company_name": "Cliente Foro Físico",
                "contact_name": "Jorge",
                "email": "fisico_foro@empresa.com",
                "password": "Password123!",
                "privacy_accepted": True,
            },
        )
        self.assertEqual(res_reg.status_code, 200)
        self.assertEqual(res_reg.json()["customer"]["id"], cust_id)

        thread_in_db = self.db.query(ForumThread).filter(ForumThread.id == thread_id).first()
        self.assertIsNotNone(thread_in_db)
        self.assertEqual(thread_in_db.customer_id, cust_id)


if __name__ == "__main__":
    unittest.main()
