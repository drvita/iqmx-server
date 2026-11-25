import secrets
import unittest

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.lib.security import create_access_token, hash_password
from app.main import app
from app.models.customer import Customer
from app.models.forum_post import ForumPost
from app.models.forum_thread import ForumThread
from app.models.role import Role
from app.models.user import User


class TestAdminForumEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()
        self.created_user_ids: list[int] = []
        self.created_customer_ids: list[int] = []
        self.created_thread_ids: list[int] = []

        self.admin_role = self._ensure_role("admin")
        self.customer_role = self._ensure_role("customer")

        self.admin = self._create_user("Admin REST Foro", self.admin_role)
        self.customer_user = self._create_user("No Admin Foro", self.customer_role)
        self.admin_headers = self._auth_headers(self.admin, "admin")
        self.non_admin_headers = self._auth_headers(self.customer_user, "customer")

        self.customer = self._create_customer("ICEFrut Test REST")

    def tearDown(self):
        if self.created_thread_ids:
            self.db.query(ForumPost).filter(ForumPost.thread_id.in_(self.created_thread_ids)).delete(
                synchronize_session=False
            )
            self.db.query(ForumThread).filter(ForumThread.id.in_(self.created_thread_ids)).delete(
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
            email=f"test_forum_{secrets.token_hex(6)}@iqmx-test.local",
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
            user_id=self.customer_user.id,
            company_name=company_name,
            contact_name="Contacto REST",
            origin="internal",
            is_active=True,
            forum_enabled=True,
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

    def test_forum_routes_require_admin(self):
        self.assertEqual(self.client.get("/api/admin/forum/threads").status_code, 401)
        self.assertEqual(self.client.get("/api/admin/forum/threads", headers=self.non_admin_headers).status_code, 403)
        self.assertEqual(self.client.get("/api/admin/forum/companies", headers=self.non_admin_headers).status_code, 403)

    def test_admin_forum_full_lifecycle(self):
        # 1. Empresas
        res_comp = self.client.get("/api/admin/forum/companies", headers=self.admin_headers)
        self.assertEqual(res_comp.status_code, 200)
        self.assertIn(self.customer.id, [c["id"] for c in res_comp.json()])

        # 2. Crear tema
        res_create = self.client.post(
            "/api/admin/forum/threads",
            headers=self.admin_headers,
            json={
                "customer_id": self.customer.id,
                "title": "Campaña Semana 48",
                "body": "Publicaciones de temporada",
                "period_label": "Semana 48 2026",
            },
        )
        self.assertEqual(res_create.status_code, 201)
        thread = res_create.json()
        thread_id = thread["id"]
        self.created_thread_ids.append(thread_id)
        self.assertEqual(thread["status"], "open")

        # 3. Filtrar listado
        res_list = self.client.get(
            f"/api/admin/forum/threads?customer_id={self.customer.id}&status=open&q=Semana",
            headers=self.admin_headers,
        )
        self.assertEqual(res_list.status_code, 200)
        self.assertEqual(res_list.json()["total"], 1)

        # 4. Publicar mensaje y respuesta
        res_p1 = self.client.post(
            f"/api/admin/forum/threads/{thread_id}/posts",
            headers=self.admin_headers,
            json={"body": "Idea principal"},
        )
        self.assertEqual(res_p1.status_code, 201)
        p1_id = res_p1.json()["id"]

        res_p2 = self.client.post(
            f"/api/admin/forum/threads/{thread_id}/posts",
            headers=self.admin_headers,
            json={"body": "Respuesta directa", "parent_post_id": p1_id},
        )
        self.assertEqual(res_p2.status_code, 201)

        # 5. Editar mensaje y cambiar estado del tema
        res_edit_p1 = self.client.patch(
            f"/api/admin/forum/posts/{p1_id}",
            headers=self.admin_headers,
            json={"body": "Idea principal actualizada"},
        )
        self.assertEqual(res_edit_p1.status_code, 200)
        self.assertEqual(res_edit_p1.json()["body"], "Idea principal actualizada")

        res_patch_t = self.client.patch(
            f"/api/admin/forum/threads/{thread_id}",
            headers=self.admin_headers,
            json={"status": "in_progress"},
        )
        self.assertEqual(res_patch_t.status_code, 200)
        self.assertEqual(res_patch_t.json()["status"], "in_progress")

        # 6. Borrar mensaje y tema
        self.assertEqual(
            self.client.delete(f"/api/admin/forum/posts/{p1_id}", headers=self.admin_headers).status_code,
            204,
        )
        self.assertEqual(
            self.client.delete(f"/api/admin/forum/threads/{thread_id}", headers=self.admin_headers).status_code,
            204,
        )
        self.assertEqual(
            self.client.get(f"/api/admin/forum/threads/{thread_id}", headers=self.admin_headers).status_code,
            404,
        )

    def test_admin_forum_attachments_and_utc_z(self):
        import tempfile
        from unittest.mock import patch
        from app.services.forum.storage import LocalForumStorage

        with tempfile.TemporaryDirectory() as tmpdir:
            storage = LocalForumStorage(tmpdir)
            with patch("app.services.forum.service.get_forum_storage", return_value=storage):
                res_create = self.client.post(
                    "/api/admin/forum/threads",
                    headers=self.admin_headers,
                    json={
                        "customer_id": self.customer.id,
                        "title": "Tema REST con archivos",
                        "body": "Prueba de upload y descarga",
                    },
                )
                self.assertEqual(res_create.status_code, 201)
                thread = res_create.json()
                self.created_thread_ids.append(thread["id"])
                self.assertTrue(thread["created_at"].endswith("Z"))

                res_up = self.client.post(
                    f"/api/admin/forum/threads/{thread['id']}/attachments",
                    headers=self.admin_headers,
                    files={"file": ("propuesta.pdf", b"%PDF-1.4\n%contenido", "application/pdf")},
                )
                self.assertEqual(res_up.status_code, 201)
                att = res_up.json()
                self.assertEqual(att["filename"], "propuesta.pdf")
                self.assertTrue(att["created_at"].endswith("Z"))

                res_dl = self.client.get(
                    f"/api/admin/forum/attachments/{att['id']}/download?inline=true",
                    headers=self.admin_headers,
                )
                self.assertEqual(res_dl.status_code, 200)
                self.assertEqual(res_dl.content, b"%PDF-1.4\n%contenido")
                self.assertEqual(res_dl.headers.get("x-content-type-options"), "nosniff")

                res_del = self.client.delete(
                    f"/api/admin/forum/attachments/{att['id']}",
                    headers=self.admin_headers,
                )
                self.assertEqual(res_del.status_code, 204)
                self.assertEqual(
                    self.client.get(
                        f"/api/admin/forum/attachments/{att['id']}/download",
                        headers=self.admin_headers,
                    ).status_code,
                    404,
                )
