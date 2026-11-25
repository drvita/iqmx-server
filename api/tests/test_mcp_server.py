import json
import secrets
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.config import settings
from app.db.database import SessionLocal
from app.lib.security import create_access_token, hash_password
from app.main import app
from app.models.api_token import ApiToken
from app.models.bot_profile import BotProfile
from app.models.customer import Customer
from app.models.forum_attachment import ForumAttachment
from app.models.forum_post import ForumPost
from app.models.forum_thread import ForumThread
from app.models.role import Role
from app.models.user import User
from app.services.bots.tokens import generate_and_store_bot_token, revoke_bot_token
from app.services.forum.service import create_thread, update_thread

MCP_HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
}


class FakeRedis:
    def __init__(self):
        self.counts: dict[str, int] = {}

    def incr(self, key: str) -> int:
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def expire(self, key: str, ttl: int) -> bool:
        return True


class TestMCPServer(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.created_user_ids: list[int] = []
        self.created_customer_ids: list[int] = []
        self.created_thread_ids: list[int] = []

        self.admin_role = self._ensure_role("admin")
        self.customer_role = self._ensure_role("customer")
        self.bot_role = self._ensure_role("bot")

        self.admin = self._create_user("Admin MCP Test", self.admin_role)
        self.company_a = self._create_customer("Empresa MCP A", is_active=True, forum_enabled=True)
        self.company_b = self._create_customer("Empresa MCP B", is_active=True, forum_enabled=True)
        self.company_hidden = self._create_customer("Empresa MCP Oculta", is_active=True, forum_enabled=False)

        self.thread_a = create_thread(
            self.db,
            customer_id=self.company_a.id,
            title="Tema MCP A",
            body="Contenido para Empresa A",
            author_user_id=self.admin.id,
        )
        self.thread_b = create_thread(
            self.db,
            customer_id=self.company_b.id,
            title="Tema MCP B",
            body="Contenido para Empresa B",
            author_user_id=self.admin.id,
        )
        self.created_thread_ids.extend([self.thread_a["id"], self.thread_b["id"]])

        self.bot_scoped = self._create_bot("Bot Scoped A", customer_id=self.company_a.id, is_active=True)
        _, self.token_scoped = generate_and_store_bot_token(
            self.db, self.bot_scoped.id, "Scoped Token", self.admin.id
        )

        self.bot_global = self._create_bot("Bot Global", customer_id=None, is_active=True)
        _, self.token_global = generate_and_store_bot_token(
            self.db, self.bot_global.id, "Global Token", self.admin.id
        )

    def tearDown(self):
        if self.created_thread_ids:
            self.db.query(ForumAttachment).filter(ForumAttachment.thread_id.in_(self.created_thread_ids)).delete(
                synchronize_session=False
            )
            self.db.query(ForumPost).filter(ForumPost.thread_id.in_(self.created_thread_ids)).delete(
                synchronize_session=False
            )
            self.db.query(ForumThread).filter(ForumThread.id.in_(self.created_thread_ids)).delete(
                synchronize_session=False
            )
            self.db.commit()

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
            email=f"test_mcp_{secrets.token_hex(6)}@iqmx-test.local",
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
            contact_name="Contacto MCP",
            origin="internal",
            is_active=is_active,
            forum_enabled=forum_enabled,
        )
        self.db.add(c)
        self.db.commit()
        self.db.refresh(c)
        self.created_customer_ids.append(c.id)
        return c

    def _create_bot(self, name: str, customer_id: int | None, is_active: bool = True) -> User:
        u = self._create_user(name, self.bot_role)
        profile = BotProfile(
            user_id=u.id,
            customer_id=customer_id,
            description="Bot de prueba",
            is_active=is_active,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(profile)
        self.db.commit()
        return u

    def _rpc(self, client: TestClient, token: str, method: str, params: dict | None = None, req_id: int = 1):
        payload = {"jsonrpc": "2.0", "id": req_id, "method": method}
        if params is not None:
            payload["params"] = params
        return client.post(
            "/mcp",
            headers={**MCP_HEADERS, "Authorization": f"Bearer {token}"},
            json=payload,
        )

    def _parse_tool_result(self, response) -> tuple[bool, dict | list | str]:
        data = response.json()
        result = data.get("result", {})
        is_error = bool(result.get("isError"))
        if "structuredContent" in result and result["structuredContent"] is not None:
            sc = result["structuredContent"]
            if isinstance(sc, dict) and set(sc.keys()) == {"result"}:
                return is_error, sc["result"]
            return is_error, sc
        text = result.get("content", [{}])[0].get("text", "")
        try:
            return is_error, json.loads(text)
        except Exception:
            return is_error, text

    def test_mcp_auth_guards(self):
        with TestClient(app) as client:
            # Sin cabecera
            res_no_auth = client.post("/mcp", headers=MCP_HEADERS, json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
            self.assertEqual(res_no_auth.status_code, 401)

            # JWT humano en /mcp -> rechazado (401 porque no tiene prefijo iqmx_bot_)
            admin_jwt = create_access_token(data={"sub": str(self.admin.id), "user_id": self.admin.id, "role": "admin"})
            res_jwt = self._rpc(client, admin_jwt, "tools/list")
            self.assertEqual(res_jwt.status_code, 401)

            # Bot pausado -> 403
            bot_paused = self._create_bot("Bot Pausado", customer_id=None, is_active=False)
            _, tok_paused = generate_and_store_bot_token(self.db, bot_paused.id, "Paused", self.admin.id)
            res_paused = self._rpc(client, tok_paused, "tools/list")
            self.assertEqual(res_paused.status_code, 403)

            # Token expirado -> 401
            bot_exp = self._create_bot("Bot Exp", customer_id=None, is_active=True)
            tok_rec, tok_exp = generate_and_store_bot_token(
                self.db, bot_exp.id, "Expired", self.admin.id, expires_at=datetime.utcnow() - timedelta(minutes=5)
            )
            res_exp = self._rpc(client, tok_exp, "tools/list")
            self.assertEqual(res_exp.status_code, 401)

            # Token revocado -> 401
            tok_rev_rec, tok_rev = generate_and_store_bot_token(self.db, self.bot_global.id, "Para revocar", self.admin.id)
            revoke_bot_token(self.db, self.bot_global.id, tok_rev_rec.id)
            res_rev = self._rpc(client, tok_rev, "tools/list")
            self.assertEqual(res_rev.status_code, 401)

            # Usuario sin rol 'bot' con token en api_tokens -> 403
            _, tok_non_bot = generate_and_store_bot_token(self.db, self.admin.id, "Admin ilegal", self.admin.id)
            res_non_bot = self._rpc(client, tok_non_bot, "tools/list")
            self.assertEqual(res_non_bot.status_code, 403)

    def test_mcp_tools_scoping_and_rate_limit(self):
        fake_redis = FakeRedis()
        with patch("app.services.forum.service.get_redis_client", return_value=fake_redis):
            with TestClient(app) as client:
                # 1. initialize y tools/list sin redirección 307
                res_init = self._rpc(
                    client,
                    self.token_scoped,
                    "initialize",
                    {
                        "protocolVersion": "2025-03-26",
                        "capabilities": {},
                        "clientInfo": {"name": "test-client", "version": "1.0.0"},
                    },
                )
                self.assertEqual(res_init.status_code, 200)

                res_tools = self._rpc(client, self.token_scoped, "tools/list", {})
                self.assertEqual(res_tools.status_code, 200)
                tool_names = {t["name"] for t in res_tools.json()["result"]["tools"]}
                self.assertEqual(
                    tool_names,
                    {
                        "list_companies",
                        "list_threads",
                        "get_thread",
                        "post_message",
                        "create_thread",
                        "get_attachment",
                        "upload_attachment",
                    },
                )

                # 2. Bot con empresa asignada: solo ve company_a
                res_comp = self._rpc(client, self.token_scoped, "tools/call", {"name": "list_companies", "arguments": {}})
                is_err, companies = self._parse_tool_result(res_comp)
                self.assertFalse(is_err)
                self.assertEqual([c["id"] for c in companies], [self.company_a.id])

                # 3. Intentar leer tema de company_b -> "Tema no encontrado"
                res_other = self._rpc(
                    client,
                    self.token_scoped,
                    "tools/call",
                    {"name": "get_thread", "arguments": {"thread_id": self.thread_b["id"]}},
                )
                is_err_other, msg_other = self._parse_tool_result(res_other)
                self.assertTrue(is_err_other)
                self.assertIn("Tema no encontrado", str(msg_other))

                # 4. Bot global ve empresas habilitadas, excluye forum_enabled=False y soporta filtro query
                res_global_comp = self._rpc(
                    client, self.token_global, "tools/call", {"name": "list_companies", "arguments": {}}
                )
                is_err_g, global_companies = self._parse_tool_result(res_global_comp)
                self.assertFalse(is_err_g)
                global_ids = {c["id"] for c in global_companies}
                self.assertIn(self.company_a.id, global_ids)
                self.assertIn(self.company_b.id, global_ids)
                self.assertNotIn(self.company_hidden.id, global_ids)

                res_filtered_comp = self._rpc(
                    client,
                    self.token_global,
                    "tools/call",
                    {"name": "list_companies", "arguments": {"query": "Empresa MCP A"}},
                )
                is_err_fc, filtered_companies = self._parse_tool_result(res_filtered_comp)
                self.assertFalse(is_err_fc)
                self.assertEqual([c["id"] for c in filtered_companies], [self.company_a.id])

                # 5. Publicar mensaje devuelve el objeto completo y verifica rate limit de escritura en llamada 11
                for idx in range(settings.MCP_RATE_LIMIT_WRITE_PER_MIN):
                    res_post = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {
                            "name": "post_message",
                            "arguments": {"thread_id": self.thread_a["id"], "body": f"Aporte #{idx + 1}"},
                        },
                        req_id=100 + idx,
                    )
                    is_err_p, post_obj = self._parse_tool_result(res_post)
                    self.assertFalse(is_err_p)
                    if idx == 0:
                        self.assertEqual(post_obj["thread_id"], self.thread_a["id"])
                        self.assertEqual(post_obj["body"], "Aporte #1")
                        self.assertEqual(post_obj["author_name"], "Bot Scoped A")
                        self.assertTrue(post_obj["author_is_bot"])

                # 5b. get_thread soporta paginación de mensajes y retorna autor en tema y mensajes
                res_page1 = self._rpc(
                    client,
                    self.token_global,
                    "tools/call",
                    {"name": "get_thread", "arguments": {"thread_id": self.thread_a["id"], "page": 1, "page_size": 4}},
                    req_id=190,
                )
                is_err_p1, page1 = self._parse_tool_result(res_page1)
                self.assertFalse(is_err_p1)
                self.assertEqual(page1["author_name"], "Admin MCP Test")
                self.assertFalse(page1["author_is_bot"])
                self.assertEqual(page1["posts_total"], 10)
                self.assertEqual(page1["posts_page"], 1)
                self.assertEqual(page1["posts_page_size"], 4)
                self.assertTrue(page1["has_more_posts"])
                self.assertEqual(len(page1["posts"]), 4)
                self.assertEqual(page1["posts"][0]["author_name"], "Bot Scoped A")

                res_page3 = self._rpc(
                    client,
                    self.token_global,
                    "tools/call",
                    {"name": "get_thread", "arguments": {"thread_id": self.thread_a["id"], "page": 3, "page_size": 4}},
                    req_id=191,
                )
                is_err_p3, page3 = self._parse_tool_result(res_page3)
                self.assertFalse(is_err_p3)
                self.assertEqual(len(page3["posts"]), 2)
                self.assertFalse(page3["has_more_posts"])

                res_rl = self._rpc(
                    client,
                    self.token_scoped,
                    "tools/call",
                    {
                        "name": "post_message",
                        "arguments": {"thread_id": self.thread_a["id"], "body": "Exceso"},
                    },
                    req_id=200,
                )
                is_err_rl, msg_rl = self._parse_tool_result(res_rl)
                self.assertTrue(is_err_rl)
                self.assertIn("Límite de solicitudes alcanzado", str(msg_rl))

                # 6. Tema terminado rechaza post_message (usando bot global para no chocar con RL)
                update_thread(self.db, self.thread_b["id"], status="done")
                res_done = self._rpc(
                    client,
                    self.token_global,
                    "tools/call",
                    {
                        "name": "post_message",
                        "arguments": {"thread_id": self.thread_b["id"], "body": "Intento en terminado"},
                    },
                )
                is_err_done, msg_done = self._parse_tool_result(res_done)
                self.assertTrue(is_err_done)
                self.assertIn("abiertos o en curso", str(msg_done))

    def test_mcp_create_thread_scoping_and_validation(self):
        fake_redis = FakeRedis()
        _, tok_scoped_create = generate_and_store_bot_token(
            self.db, self.bot_scoped.id, "Scoped Create", self.admin.id
        )
        with patch("app.services.forum.service.get_redis_client", return_value=fake_redis):
            with TestClient(app) as client:
                # 1. Bot scoped puede crear tema en su empresa (company_a)
                res_ok = self._rpc(
                    client,
                    tok_scoped_create,
                    "tools/call",
                    {
                        "name": "create_thread",
                        "arguments": {
                            "company_id": self.company_a.id,
                            "title": "Nueva idea creada por Bot",
                            "body": "Propuesta generada vía MCP create_thread.",
                            "period_label": "Semana 48 2026",
                        },
                    },
                )
                is_err, created = self._parse_tool_result(res_ok)
                self.assertFalse(is_err)
                self.created_thread_ids.append(created["id"])
                self.assertEqual(created["company_id"], self.company_a.id)
                self.assertEqual(created["status"], "open")

                # 2. Bot scoped NO puede crear tema en otra empresa (company_b)
                res_denied = self._rpc(
                    client,
                    tok_scoped_create,
                    "tools/call",
                    {
                        "name": "create_thread",
                        "arguments": {
                            "company_id": self.company_b.id,
                            "title": "Intento fuera de alcance",
                            "body": "Debe rechazarse.",
                        },
                    },
                )
                is_err_den, msg_den = self._parse_tool_result(res_denied)
                self.assertTrue(is_err_den)
                self.assertIn("Empresa no encontrada o sin acceso", str(msg_den))

                # 3. Bot global puede crear tema en company_b con due_at ISO válido
                res_global = self._rpc(
                    client,
                    self.token_global,
                    "tools/call",
                    {
                        "name": "create_thread",
                        "arguments": {
                            "company_id": self.company_b.id,
                            "title": "Campaña Global desde Bot",
                            "body": "Contenido de campaña global.",
                            "due_at": "2026-12-01T23:59:59",
                        },
                    },
                )
                is_err_g, created_g = self._parse_tool_result(res_global)
                self.assertFalse(is_err_g)
                self.created_thread_ids.append(created_g["id"])
                self.assertEqual(created_g["company_id"], self.company_b.id)

                # 4. Fecha inválida rechazada con mensaje claro
                res_bad_dt = self._rpc(
                    client,
                    self.token_global,
                    "tools/call",
                    {
                        "name": "create_thread",
                        "arguments": {
                            "company_id": self.company_b.id,
                            "title": "Fecha mala",
                            "body": "Contenido",
                            "due_at": "no-es-fecha",
                        },
                    },
                )
                is_err_dt, msg_dt = self._parse_tool_result(res_bad_dt)
                self.assertTrue(is_err_dt)
                self.assertIn("ISO-8601", str(msg_dt))

    def test_mcp_get_thread_returns_nested_replies(self):
        from app.services.forum.service import create_post as service_create_post

        fake_redis = FakeRedis()
        with patch("app.services.forum.service.get_redis_client", return_value=fake_redis):
            with TestClient(app) as client:
                res_p1 = self._rpc(
                    client,
                    self.token_scoped,
                    "tools/call",
                    {"name": "post_message", "arguments": {"thread_id": self.thread_a["id"], "body": "Idea principal 1"}},
                    req_id=301,
                )
                is_err, p1 = self._parse_tool_result(res_p1)
                self.assertFalse(is_err)

                res_p2 = self._rpc(
                    client,
                    self.token_scoped,
                    "tools/call",
                    {"name": "post_message", "arguments": {"thread_id": self.thread_a["id"], "body": "Idea principal 2"}},
                    req_id=302,
                )
                is_err, p2 = self._parse_tool_result(res_p2)
                self.assertFalse(is_err)

                res_r1 = self._rpc(
                    client,
                    self.token_global,
                    "tools/call",
                    {
                        "name": "post_message",
                        "arguments": {
                            "thread_id": self.thread_a["id"],
                            "body": "Respuesta bot a idea 1",
                            "reply_to_post_id": p1["id"],
                        },
                    },
                    req_id=303,
                )
                is_err, r1 = self._parse_tool_result(res_r1)
                self.assertFalse(is_err)

                r1_human = service_create_post(
                    self.db,
                    thread_id=self.thread_a["id"],
                    body="Respuesta humana a idea 1",
                    author_user_id=self.admin.id,
                    is_bot=False,
                    parent_post_id=p1["id"],
                )

                res_page1 = self._rpc(
                    client,
                    self.token_global,
                    "tools/call",
                    {"name": "get_thread", "arguments": {"thread_id": self.thread_a["id"], "page": 1, "page_size": 1}},
                    req_id=304,
                )
                is_err_g, detail = self._parse_tool_result(res_page1)
                self.assertFalse(is_err_g)
                self.assertEqual(detail["posts_total"], 2)
                self.assertEqual(detail["total_messages"], 4)
                self.assertEqual(detail["posts_page"], 1)
                self.assertEqual(detail["posts_page_size"], 1)
                self.assertTrue(detail["has_more_posts"])
                self.assertEqual(len(detail["posts"]), 1)

                root = detail["posts"][0]
                self.assertEqual(root["id"], p1["id"])
                self.assertEqual(len(root["replies"]), 2)
                self.assertEqual(root["replies"][0]["id"], r1["id"])
                self.assertEqual(root["replies"][0]["parent_post_id"], p1["id"])
                self.assertEqual(root["replies"][0]["author_name"], "Bot Global")
                self.assertTrue(root["replies"][0]["author_is_bot"])
                self.assertEqual(root["replies"][1]["id"], r1_human["id"])
                self.assertEqual(root["replies"][1]["author_name"], "Admin MCP Test")
                self.assertFalse(root["replies"][1]["author_is_bot"])

                res_page2 = self._rpc(
                    client,
                    self.token_global,
                    "tools/call",
                    {"name": "get_thread", "arguments": {"thread_id": self.thread_a["id"], "page": 2, "page_size": 1}},
                    req_id=305,
                )
                is_err_g2, detail2 = self._parse_tool_result(res_page2)
                self.assertFalse(is_err_g2)
                self.assertFalse(detail2["has_more_posts"])
                self.assertEqual(detail2["posts"][0]["id"], p2["id"])
                self.assertEqual(detail2["posts"][0]["replies"], [])

    def test_mcp_get_attachment_scoping_and_utc_dates(self):
        import base64
        import tempfile
        from app.services.forum.service import create_attachment
        from app.services.forum.storage import LocalForumStorage

        fake_redis = FakeRedis()
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = LocalForumStorage(tmpdir)
            with (
                patch("app.services.forum.service.get_redis_client", return_value=fake_redis),
                patch("app.services.forum.service.get_forum_storage", return_value=storage),
            ):
                att_txt = create_attachment(
                    self.db,
                    thread_id=self.thread_a["id"],
                    post_id=None,
                    filename="notas.md",
                    content_type="text/markdown",
                    data=b"# Hola\nArchivo de prueba",
                    uploaded_by_user_id=self.admin.id,
                )
                att_pdf_b = create_attachment(
                    self.db,
                    thread_id=self.thread_b["id"],
                    post_id=None,
                    filename="secreto_b.pdf",
                    content_type="application/pdf",
                    data=b"%PDF-1.4\n%B",
                    uploaded_by_user_id=self.admin.id,
                )

                with TestClient(app) as client:
                    # 1. get_thread incluye attachments y fechas con Z
                    res_t = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {"name": "get_thread", "arguments": {"thread_id": self.thread_a["id"]}},
                        req_id=401,
                    )
                    is_err, detail = self._parse_tool_result(res_t)
                    self.assertFalse(is_err)
                    self.assertEqual(len(detail["attachments"]), 1)
                    self.assertEqual(detail["attachments"][0]["id"], att_txt["id"])
                    self.assertTrue(detail["attachments"][0]["created_at"].endswith("Z"))

                    # 2. get_attachment devuelve texto utf-8
                    res_att = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {"name": "get_attachment", "arguments": {"attachment_id": att_txt["id"]}},
                        req_id=402,
                    )
                    is_err_a, att_data = self._parse_tool_result(res_att)
                    self.assertFalse(is_err_a)
                    self.assertEqual(att_data["encoding"], "utf-8")
                    self.assertIn("Archivo de prueba", att_data["content"])

                    # 3. Bot scoped NO puede descargar adjunto de empresa B
                    res_denied = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {"name": "get_attachment", "arguments": {"attachment_id": att_pdf_b["id"]}},
                        req_id=403,
                    )
                    is_err_d, msg_d = self._parse_tool_result(res_denied)
                    self.assertTrue(is_err_d)
                    self.assertIn("no encontrado", str(msg_d).lower())

                    # 4. Bot global sí lee el PDF de empresa B en base64
                    res_pdf = self._rpc(
                        client,
                        self.token_global,
                        "tools/call",
                        {"name": "get_attachment", "arguments": {"attachment_id": att_pdf_b["id"]}},
                        req_id=404,
                    )
                    is_err_p, pdf_data = self._parse_tool_result(res_pdf)
                    self.assertFalse(is_err_p)
                    self.assertEqual(pdf_data["encoding"], "base64")
                    self.assertEqual(base64.b64decode(pdf_data["content"]), b"%PDF-1.4\n%B")

    def test_mcp_upload_attachment_scoping_validation_and_roundtrip(self):
        import base64
        import tempfile
        from app.services.forum.storage import LocalForumStorage

        fake_redis = FakeRedis()
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = LocalForumStorage(tmpdir)
            with (
                patch("app.services.forum.service.get_redis_client", return_value=fake_redis),
                patch("app.services.forum.service.get_forum_storage", return_value=storage),
            ):
                with TestClient(app) as client:
                    # 1. Crear mensaje en thread_a y adjuntar PDF con prefijo data URI base64
                    res_post = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {"name": "post_message", "arguments": {"thread_id": self.thread_a["id"], "body": "Mensaje con PDF"}},
                        req_id=501,
                    )
                    is_err_p, post_obj = self._parse_tool_result(res_post)
                    self.assertFalse(is_err_p)

                    pdf_bytes = b"%PDF-1.4\n%Propuesta Lugo"
                    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
                    res_up_pdf = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {
                            "name": "upload_attachment",
                            "arguments": {
                                "thread_id": self.thread_a["id"],
                                "post_id": post_obj["id"],
                                "filename": "propuesta_lugo.pdf",
                                "content": f"data:application/pdf;base64,{pdf_b64}",
                                "encoding": "base64",
                            },
                        },
                        req_id=502,
                    )
                    is_err_up, up_pdf = self._parse_tool_result(res_up_pdf)
                    self.assertFalse(is_err_up)
                    self.assertEqual(up_pdf["thread_id"], self.thread_a["id"])
                    self.assertEqual(up_pdf["post_id"], post_obj["id"])
                    self.assertEqual(up_pdf["filename"], "propuesta_lugo.pdf")
                    self.assertEqual(up_pdf["content_type"], "application/pdf")
                    self.assertEqual(up_pdf["size_bytes"], len(pdf_bytes))
                    self.assertTrue(up_pdf["created_at"].endswith("Z"))

                    # 2. Roundtrip: get_thread incluye el adjunto en el post y get_attachment devuelve los bytes exactos
                    res_thread = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {"name": "get_thread", "arguments": {"thread_id": self.thread_a["id"]}},
                        req_id=503,
                    )
                    is_err_t, detail = self._parse_tool_result(res_thread)
                    self.assertFalse(is_err_t)
                    matching_posts = [p for p in detail["posts"] if p["id"] == post_obj["id"]]
                    self.assertEqual(len(matching_posts), 1)
                    self.assertEqual(len(matching_posts[0]["attachments"]), 1)
                    self.assertEqual(matching_posts[0]["attachments"][0]["id"], up_pdf["id"])

                    res_get = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {"name": "get_attachment", "arguments": {"attachment_id": up_pdf["id"]}},
                        req_id=504,
                    )
                    is_err_g, get_pdf = self._parse_tool_result(res_get)
                    self.assertFalse(is_err_g)
                    self.assertEqual(get_pdf["encoding"], "base64")
                    self.assertEqual(base64.b64decode(get_pdf["content"]), pdf_bytes)

                    # 3. Subir archivo .md en utf-8 directamente al tema raíz (post_id=None)
                    md_text = "# Resumen Ejecutivo\n\nTodo listo."
                    res_up_md = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {
                            "name": "upload_attachment",
                            "arguments": {
                                "thread_id": self.thread_a["id"],
                                "filename": "resumen.md",
                                "content": md_text,
                                "encoding": "utf-8",
                            },
                        },
                        req_id=505,
                    )
                    is_err_md, up_md = self._parse_tool_result(res_up_md)
                    self.assertFalse(is_err_md)
                    self.assertIsNone(up_md["post_id"])
                    self.assertEqual(up_md["content_type"], "text/markdown")

                    res_get_md = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {"name": "get_attachment", "arguments": {"attachment_id": up_md["id"]}},
                        req_id=506,
                    )
                    is_err_gmd, get_md = self._parse_tool_result(res_get_md)
                    self.assertFalse(is_err_gmd)
                    self.assertEqual(get_md["encoding"], "utf-8")
                    self.assertEqual(get_md["content"], md_text)

                    # 4. Bot scoped NO puede subir archivos a thread_b (otra empresa)
                    res_denied = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {
                            "name": "upload_attachment",
                            "arguments": {
                                "thread_id": self.thread_b["id"],
                                "filename": "ajeno.md",
                                "content": "No permitido",
                                "encoding": "utf-8",
                            },
                        },
                        req_id=507,
                    )
                    is_err_den, msg_den = self._parse_tool_result(res_denied)
                    self.assertTrue(is_err_den)
                    self.assertIn("Tema no encontrado", str(msg_den))

                    # 5. Tema cerrado (status='done') rechaza upload_attachment
                    update_thread(self.db, self.thread_b["id"], status="done")
                    res_done = self._rpc(
                        client,
                        self.token_global,
                        "tools/call",
                        {
                            "name": "upload_attachment",
                            "arguments": {
                                "thread_id": self.thread_b["id"],
                                "filename": "tarde.md",
                                "content": "Tema cerrado",
                                "encoding": "utf-8",
                            },
                        },
                        req_id=508,
                    )
                    is_err_done, msg_done = self._parse_tool_result(res_done)
                    self.assertTrue(is_err_done)
                    self.assertIn("abiertos o en curso", str(msg_done))

                    # 6. Base64 corrupto rechazado
                    res_bad_b64 = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {
                            "name": "upload_attachment",
                            "arguments": {
                                "thread_id": self.thread_a["id"],
                                "filename": "corrupto.pdf",
                                "content": "%%%no-valido%%%",
                                "encoding": "base64",
                            },
                        },
                        req_id=509,
                    )
                    is_err_b64, msg_b64 = self._parse_tool_result(res_bad_b64)
                    self.assertTrue(is_err_b64)
                    self.assertIn("base64", str(msg_b64).lower())

                    # 7. Magic bytes inválidos rechazados (.pdf con contenido de texto plano)
                    fake_pdf_b64 = base64.b64encode(b"no soy pdf").decode("ascii")
                    res_bad_magic = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {
                            "name": "upload_attachment",
                            "arguments": {
                                "thread_id": self.thread_a["id"],
                                "filename": "falso.pdf",
                                "content": fake_pdf_b64,
                                "encoding": "base64",
                            },
                        },
                        req_id=510,
                    )
                    is_err_magic, msg_magic = self._parse_tool_result(res_bad_magic)
                    self.assertTrue(is_err_magic)
                    self.assertIn("PDF válido", str(msg_magic))

                    # 8. Encoding no soportado rechazado
                    res_bad_enc = self._rpc(
                        client,
                        self.token_scoped,
                        "tools/call",
                        {
                            "name": "upload_attachment",
                            "arguments": {
                                "thread_id": self.thread_a["id"],
                                "filename": "texto.txt",
                                "content": "hola",
                                "encoding": "latin-1",
                            },
                        },
                        req_id=511,
                    )
                    is_err_enc, _ = self._parse_tool_result(res_bad_enc)
                    self.assertTrue(is_err_enc)
