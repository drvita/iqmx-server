import secrets
import unittest

from app.db.database import SessionLocal
from app.lib.security import hash_password
from app.models.customer import Customer
from app.models.role import Role
from app.models.user import User
from app.services.forum.service import (
    ForumNotFoundError,
    ForumPermissionError,
    ForumValidationError,
    create_post,
    create_thread,
    get_thread_detail,
    list_threads,
    list_visible_companies,
    soft_delete_post,
    soft_delete_thread,
    update_post,
    update_thread,
)


class TestForumService(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.created_user_ids: list[int] = []
        self.created_customer_ids: list[int] = []
        self.created_thread_ids: list[int] = []

        self.admin_role = self._ensure_role("admin")
        self.customer_role = self._ensure_role("customer")
        self.bot_role = self._ensure_role("bot")

        self.admin = self._create_user("Admin Foro Test", self.admin_role)
        self.other_admin = self._create_user("Otro Admin Test", self.admin_role)
        self.bot_user = self._create_user("Bot Foro Test", self.bot_role)

        self.company_a = self._create_customer("Empresa A Foro Test", is_active=True, forum_enabled=True)
        self.company_b = self._create_customer("Empresa B Foro Test", is_active=True, forum_enabled=True)
        self.company_hidden = self._create_customer("Empresa Oculta Foro Test", is_active=True, forum_enabled=False)
        self.company_inactive = self._create_customer("Empresa Inactiva Test", is_active=False, forum_enabled=True)

    def tearDown(self):
        from app.models.forum_post import ForumPost
        from app.models.forum_thread import ForumThread

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
            email=f"test_{secrets.token_hex(6)}@iqmx-test.local",
            password_hash=hash_password("TestPass123!"),
            role_id=role.id,
        )
        u.roles.append(role)
        self.db.add(u)
        self.db.commit()
        self.db.refresh(u)
        self.created_user_ids.append(u.id)
        return u

    def _create_customer(self, company_name: str, is_active: bool = True, forum_enabled: bool = True) -> Customer:
        owner = self._create_user(f"Owner {company_name}", self.customer_role)
        c = Customer(
            user_id=owner.id,
            company_name=company_name,
            contact_name=f"Contacto {company_name}",
            origin="internal",
            is_active=is_active,
            forum_enabled=forum_enabled,
        )
        self.db.add(c)
        self.db.commit()
        self.db.refresh(c)
        self.created_customer_ids.append(c.id)
        return c

    def test_visible_companies_filters_inactive_and_scoped(self):
        all_active = list_visible_companies(self.db)
        ids = {c["id"] for c in all_active}
        self.assertIn(self.company_a.id, ids)
        self.assertIn(self.company_b.id, ids)
        self.assertNotIn(self.company_hidden.id, ids)
        self.assertNotIn(self.company_inactive.id, ids)

        filtered = list_visible_companies(self.db, query_text="Empresa A Foro")
        self.assertEqual([c["id"] for c in filtered], [self.company_a.id])

        scoped = list_visible_companies(self.db, scoped_customer_id=self.company_a.id)
        self.assertEqual([c["id"] for c in scoped], [self.company_a.id])

        with self.assertRaises(ForumNotFoundError):
            create_thread(
                self.db,
                customer_id=self.company_hidden.id,
                title="No habilitada",
                body="Debe fallar",
                author_user_id=self.admin.id,
            )

    def test_thread_and_post_rules_and_soft_delete(self):
        t = create_thread(
            self.db,
            customer_id=self.company_a.id,
            title="Campaña semana 48",
            body="Definir publicaciones para temporada.",
            author_user_id=self.admin.id,
            period_label="Semana 48 2026",
        )
        self.created_thread_ids.append(t["id"])
        self.assertEqual(t["status"], "open")

        p1 = create_post(
            self.db,
            thread_id=t["id"],
            body="Propuesta inicial del admin",
            author_user_id=self.admin.id,
            is_bot=False,
        )
        self.assertFalse(p1["author_is_bot"])

        p2 = create_post(
            self.db,
            thread_id=t["id"],
            body="Respuesta de Danna bot",
            author_user_id=self.bot_user.id,
            is_bot=True,
            parent_post_id=p1["id"],
        )
        self.assertTrue(p2["author_is_bot"])
        self.assertEqual(p2["parent_post_id"], p1["id"])

        # No se permite segundo nivel de respuesta
        with self.assertRaises(ForumValidationError):
            create_post(
                self.db,
                thread_id=t["id"],
                body="Tercer nivel inválido",
                author_user_id=self.admin.id,
                is_bot=False,
                parent_post_id=p2["id"],
            )

        # Solo el autor admin puede editar su mensaje
        with self.assertRaises(ForumPermissionError):
            update_post(self.db, post_id=p1["id"], body="Editado", editor_user_id=self.other_admin.id)

        edited = update_post(self.db, post_id=p1["id"], body="Propuesta editada", editor_user_id=self.admin.id)
        self.assertEqual(edited["body"], "Propuesta editada")

        # Borrar p1 que tiene respuesta p2 -> se conserva como "Mensaje eliminado"
        soft_delete_post(self.db, p1["id"])
        detail = get_thread_detail(self.db, t["id"])
        self.assertEqual(len(detail["posts"]), 2)
        self.assertTrue(detail["posts"][0]["deleted"])
        self.assertEqual(detail["posts"][0]["body"], "Mensaje eliminado")

        # Borrar p2 -> p1 ya no tiene respuestas activas y ambos desaparecen
        soft_delete_post(self.db, p2["id"])
        detail_after = get_thread_detail(self.db, t["id"])
        self.assertEqual(len(detail_after["posts"]), 0)

        # Validaciones de longitud y contenido vacío
        with self.assertRaises(ForumValidationError):
            create_post(self.db, thread_id=t["id"], body="   ", author_user_id=self.bot_user.id, is_bot=True)
        with self.assertRaises(ForumValidationError):
            create_post(self.db, thread_id=t["id"], body="x" * 10001, author_user_id=self.bot_user.id, is_bot=True)

        # Cambiar estado a done -> bot no puede comentar, admin sí
        update_thread(self.db, t["id"], status="done")
        with self.assertRaises(ForumValidationError):
            create_post(self.db, thread_id=t["id"], body="Bot tarde", author_user_id=self.bot_user.id, is_bot=True)
        admin_late = create_post(self.db, thread_id=t["id"], body="Cierre admin", author_user_id=self.admin.id, is_bot=False)
        self.assertIsNotNone(admin_late["id"])

        # Archivado -> nadie comenta
        update_thread(self.db, t["id"], status="archived")
        with self.assertRaises(ForumValidationError):
            create_post(self.db, thread_id=t["id"], body="En archivado", author_user_id=self.admin.id, is_bot=False)

        # Scoping por empresa
        with self.assertRaises(ForumNotFoundError):
            get_thread_detail(self.db, t["id"], scoped_customer_id=self.company_b.id)

        listed = list_threads(self.db, scoped_customer_id=self.company_b.id)
        self.assertNotIn(t["id"], [item["id"] for item in listed["items"]])

        soft_delete_thread(self.db, t["id"])
        with self.assertRaises(ForumNotFoundError):
            get_thread_detail(self.db, t["id"])
