import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models import User, Customer, CustomerWebhook

class TestPortalAuth(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_register_and_login_flow(self):
        email = "test_portal_user@empresaejemplo.com"
        
        # Limpiar usuario previo si existiera
        db = SessionLocal()
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            db.delete(existing)
            db.commit()
        db.close()

        # 1. Registro con consentimiento legal
        register_payload = {
            "company_name": "Empresa Ejemplo S.A.",
            "contact_name": "Laura Directora",
            "email": email,
            "phone": "+523149991122",
            "password": "SecurePassword.123#",
            "tax_id": "EEJ101010ABC",
            "privacy_accepted": True
        }
        res_reg = self.client.post("/api/portal/auth/register", json=register_payload)
        self.assertEqual(res_reg.status_code, 200, f"Error en register: {res_reg.text}")
        data_reg = res_reg.json()
        self.assertIn("access_token", data_reg)
        self.assertEqual(data_reg["customer"]["company_name"], "Empresa Ejemplo S.A.")
        self.assertEqual(data_reg["customer"]["origin"], "web_signup")

        token = data_reg["access_token"]

        # 2. Verificar perfil /me con el token
        res_me = self.client.get("/api/portal/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_me.status_code, 200)
        data_me = res_me.json()
        self.assertEqual(data_me["email"], email)

        # 3. Registro duplicado debe fallar con 400
        res_dup = self.client.post("/api/portal/auth/register", json=register_payload)
        self.assertEqual(res_dup.status_code, 400)

        # 4. Login con credenciales correctas
        login_payload = {
            "email": email,
            "password": "SecurePassword.123#"
        }
        res_login = self.client.post("/api/portal/auth/login", json=login_payload)
        self.assertEqual(res_login.status_code, 200)
        self.assertIn("access_token", res_login.json())

        # 5. Login con contraseña errónea debe dar 401
        bad_login = {
            "email": email,
            "password": "WrongPassword!"
        }
        res_bad = self.client.post("/api/portal/auth/login", json=bad_login)
        self.assertEqual(res_bad.status_code, 401)

    def test_register_without_privacy_rejection(self):
        payload = {
            "company_name": "Sin Consentimiento S.A.",
            "contact_name": "Pedro",
            "email": "sin_consentimiento@test.com",
            "password": "Password.123#",
            "privacy_accepted": False
        }
        res = self.client.post("/api/portal/auth/register", json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Aviso de Privacidad", res.json()["detail"])

if __name__ == "__main__":
    unittest.main()
