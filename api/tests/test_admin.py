import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.role import Role

class TestAdminModule(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_admin_status_endpoint(self):
        """Verifica que el endpoint /status responda con código 200 y setup_required booleano."""
        res = self.client.get("/api/admin/auth/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("setup_required", data)
        self.assertIn("admin_count", data)

    def test_admin_login_wrong_credentials_fails(self):
        """Credenciales incorrectas deben retornar 401."""
        res = self.client.post("/api/admin/auth/login", json={
            "email": "inexistente@iqmx.com",
            "password": "PasswordIncorrecta123"
        })
        self.assertEqual(res.status_code, 401)

    def test_admin_catalog_products_list_protected(self):
        """El catálogo de productos de administración requiere token Bearer."""
        res = self.client.get("/api/admin/catalog/products")
        self.assertEqual(res.status_code, 401)

    def test_admin_customers_endpoints(self):
        """Verifica que el listado de clientes administrativos esté protegido y funcione con token."""
        # 1. Sin token -> 401
        res = self.client.get("/api/admin/customers")
        self.assertEqual(res.status_code, 401)

        # 2. Con token de admin
        from app.lib.security import create_access_token
        admin = self.db.query(User).filter(User.email == "chava.galindo.82@gmail.com").first()
        if not admin:
            return
        token = create_access_token(data={"sub": str(admin.id), "user_id": admin.id, "email": admin.email, "role": "admin"})
        headers = {"Authorization": f"Bearer {token}"}

        res_auth = self.client.get("/api/admin/customers", headers=headers)
        self.assertEqual(res_auth.status_code, 200)
        data = res_auth.json()
        self.assertIsInstance(data, list)
        if len(data) > 0:
            first = data[0]
            self.assertIn("company_name", first)
            self.assertIn("email", first)
            self.assertIn("is_active", first)
            self.assertIn("active_plans", first)


if __name__ == "__main__":
    unittest.main()
