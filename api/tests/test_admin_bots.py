import secrets
import unittest
from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.lib.security import create_access_token, hash_password
from app.main import app
from app.models.api_token import ApiToken
from app.models.bot_profile import BotProfile
from app.models.customer import Customer
from app.models.role import Role
from app.models.user import User


class TestAdminBotsModule(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()
        self.created_user_ids: list[int] = []
        self.created_customer_ids: list[int] = []

        self.admin_role = self._ensure_role("admin")
        self.customer_role = self._ensure_role("customer")
        self.bot_role = self._ensure_role("bot")

        self.admin = self._create_user("Admin Bots Test", self.admin_role)
        self.non_admin = self._create_user("Cliente Bots Test", self.customer_role)

        self.admin_headers = self._auth_headers(self.admin, "admin")
        self.non_admin_headers = self._auth_headers(self.non_admin, "customer")

        self.customer = self._create_customer("Empresa Bot Test")

    def tearDown(self):
        if self.created_user_ids:
            self.db.query(ApiToken).filter(ApiToken.user_id.in_(self.created_user_ids)).delete(
                synchronize_session=False
            )
            self.db.query(BotProfile).filter(BotProfile.user_id.in_(self.created_user_ids)).delete(
                synchronize_session=False
            )
            self.db.commit()

        if self.created_customer_ids:
            self.db.query(Customer).filter(Customer.id.in_(self.created_customer_ids)).delete(
                synchronize_session=False
            )
            self.db.commit()

        if self.created_user_ids:
            self.db.query(User).filter(User.id.in_(self.created_user_ids)).delete(
                synchronize_session=False
            )
            self.db.commit()

        self.db.close()

    def _ensure_role(self, name: str) -> Role:
        role = self.db.query(Role).filter(Role.name == name).first()
        if not role:
            role = Role(name=name)
            self.db.add(role)
            self.db.commit()
            self.db.refresh(role)
        return role

    def _create_user(self, name: str, role: Role) -> User:
        u = User(
            name=name,
            email=f"test_bots_{secrets.token_hex(6)}@iqmx-test.local",
            password_hash=hash_password("TestPass123!"),
            role_id=role.id,
        )
        u.roles.append(role)
        self.db.add(u)
        self.db.commit()
        self.db.refresh(u)
        self.created_user_ids.append(u.id)
        return u

    def _create_customer(self, company_name: str) -> Customer:
        c = Customer(
            user_id=self.non_admin.id,
            company_name=company_name,
            contact_name="Contacto Bot",
            origin="internal",
            is_active=True,
        )
        self.db.add(c)
        self.db.commit()
        self.db.refresh(c)
        self.created_customer_ids.append(c.id)
        return c

    def _auth_headers(self, user: User, role: str) -> dict:
        token = create_access_token(
            data={"sub": str(user.id), "user_id": user.id, "email": user.email, "role": role}
        )
        return {"Authorization": f"Bearer {token}"}

    def test_bots_endpoints_require_admin(self):
        self.assertEqual(self.client.get("/api/admin/bots").status_code, 401)
        self.assertEqual(self.client.get("/api/admin/bots", headers=self.non_admin_headers).status_code, 403)

    def test_create_update_bot_tokens_and_login_isolation(self):
        # 1. Crear bot con empresa asignada
        res = self.client.post(
            "/api/admin/bots",
            headers=self.admin_headers,
            json={"name": "Danna Piloto", "description": "Asistente de campañas", "customer_id": self.customer.id},
        )
        self.assertEqual(res.status_code, 201)
        bot = res.json()
        bot_id = bot["id"]
        self.created_user_ids.append(bot_id)
        self.assertEqual(bot["customer_id"], self.customer.id)
        self.assertEqual(bot["company_name"], self.customer.company_name)
        self.assertTrue(bot["is_active"])

        # 2. Actualizar bot para darle acceso a todas las empresas (customer_id: null)
        res_patch = self.client.patch(
            f"/api/admin/bots/{bot_id}",
            headers=self.admin_headers,
            json={"customer_id": None, "description": "Acceso global"},
        )
        self.assertEqual(res_patch.status_code, 200)
        self.assertIsNone(res_patch.json()["customer_id"])
        self.assertIsNone(res_patch.json()["company_name"])

        # 3. Generar token y verificar que en DB solo exista el hash SHA-256
        res_tok = self.client.post(
            f"/api/admin/bots/{bot_id}/tokens",
            headers=self.admin_headers,
            json={"name": "Token Producción"},
        )
        self.assertEqual(res_tok.status_code, 201)
        tok_data = res_tok.json()
        raw_token = tok_data["token"]
        self.assertTrue(raw_token.startswith("iqmx_bot_"))
        self.assertEqual(tok_data["token_prefix"], raw_token[:13])

        db_tok = self.db.query(ApiToken).filter(ApiToken.id == tok_data["id"]).first()
        self.assertIsNotNone(db_tok)
        self.assertNotEqual(db_tok.token_hash, raw_token)
        self.assertEqual(len(db_tok.token_hash), 64)

        # 4. Listado de tokens nunca expone el token en claro
        res_list_tok = self.client.get(f"/api/admin/bots/{bot_id}/tokens", headers=self.admin_headers)
        self.assertEqual(res_list_tok.status_code, 200)
        self.assertNotIn("token", res_list_tok.json()[0])

        # 5. Token de bot rechazado con 401 en rutas REST protegidas (/api/*)
        bot_headers = {"Authorization": f"Bearer {raw_token}"}
        self.assertEqual(self.client.get("/api/admin/customers", headers=bot_headers).status_code, 401)
        self.assertEqual(self.client.get("/api/admin/forum/threads", headers=bot_headers).status_code, 401)
        self.assertEqual(self.client.get("/api/portal/subscriptions/my", headers=bot_headers).status_code, 401)

        # 6. Usuario bot bloqueado en logins por contraseña
        bot_user = self.db.query(User).filter(User.id == bot_id).first()
        bot_user.password_hash = hash_password("TempPass123!")
        self.db.commit()

        res_admin_login = self.client.post(
            "/api/admin/auth/login", json={"email": bot_user.email, "password": "TempPass123!"}
        )
        self.assertEqual(res_admin_login.status_code, 403)

        res_portal_login = self.client.post(
            "/api/portal/auth/login", json={"email": bot_user.email, "password": "TempPass123!"}
        )
        self.assertEqual(res_portal_login.status_code, 403)

        # 7. Rechazar fecha de expiración en el pasado
        past_dt = (datetime.utcnow() - timedelta(days=1)).isoformat()
        res_past = self.client.post(
            f"/api/admin/bots/{bot_id}/tokens",
            headers=self.admin_headers,
            json={"name": "Expirado", "expires_at": past_dt},
        )
        self.assertEqual(res_past.status_code, 400)

        # 8. Revocar token
        res_rev = self.client.post(
            f"/api/admin/bots/{bot_id}/tokens/{tok_data['id']}/revoke",
            headers=self.admin_headers,
        )
        self.assertEqual(res_rev.status_code, 204)
        self.db.expire_all()
        db_tok = self.db.query(ApiToken).filter(ApiToken.id == tok_data["id"]).first()
        self.assertIsNotNone(db_tok.revoked_at)

        # 9. /api/admin/users sigue rechazando creación o conversión a rol 'bot'
        res_bad_user = self.client.post(
            "/api/admin/users",
            headers=self.admin_headers,
            json={
                "name": "Bot Ilegal",
                "email": f"illegal_{secrets.token_hex(4)}@iqmx.com",
                "password": "Password123!",
                "role": "bot",
            },
        )
        self.assertEqual(res_bad_user.status_code, 422)

        res_patch_role = self.client.patch(
            f"/api/admin/users/{self.admin.id}",
            headers=self.admin_headers,
            json={"role": "bot"},
        )
        self.assertEqual(res_patch_role.status_code, 422)

        res_grant_bot = self.client.put(
            f"/api/admin/users/{bot_id}/customer-role",
            headers=self.admin_headers,
            json={"company_name": "Empresa Test", "contact_name": "Contacto Test"},
        )
        self.assertEqual(res_grant_bot.status_code, 400)
