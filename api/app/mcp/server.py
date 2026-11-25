from __future__ import annotations

import contextvars
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings

from app.db.database import SessionLocal
from app.services.bots.tokens import BotActor, BotTokenAuthError, authenticate_bot_token
from app.services.forum.service import (
    ForumError,
    check_mcp_rate_limit,
    create_post,
    create_thread as create_forum_thread,
    get_thread_detail,
    list_threads as list_forum_threads,
    list_visible_companies,
)

logger = logging.getLogger("uvicorn.error")

_current_bot_actor: contextvars.ContextVar[Optional[BotActor]] = contextvars.ContextVar(
    "current_bot_actor", default=None
)

mcp_server = MCPServer(
    name="iqmx-forum",
    instructions=(
        "Servidor del Foro Colaborativo de IQISSMexico. "
        "Usa list_companies para conocer las empresas disponibles, list_threads para explorar temas, "
        "get_thread para leer la conversación completa de un tema, create_thread para abrir un nuevo tema "
        "y post_message para aportar ideas o comentarios."
    ),
)


def _require_actor() -> BotActor:
    actor = _current_bot_actor.get()
    if actor is None:
        raise RuntimeError("No hay un actor bot autenticado en el contexto actual.")
    return actor


def _log_tool_call(actor: BotActor, tool_name: str, thread_id: Optional[int], outcome: str) -> None:
    logger.info(
        f"MCP tool={tool_name} bot_id={actor.user_id} thread_id={thread_id} outcome={outcome}"
    )


def _serialize_dt(dt: Any) -> Optional[str]:
    if dt is None:
        return None
    return dt.isoformat() if hasattr(dt, "isoformat") else str(dt)


@mcp_server.tool(
    name="list_companies",
    description=(
        "Lista las empresas activas y habilitadas en el foro disponibles para este bot (id y nombre de empresa). "
        "Puedes pasar opcionalmente query (texto) para filtrar por nombre."
    ),
)
def list_companies(query: Optional[str] = None) -> list[dict[str, Any]]:
    actor = _require_actor()
    try:
        check_mcp_rate_limit(actor.token_id, "read")
        db = SessionLocal()
        try:
            companies = list_visible_companies(
                db,
                scoped_customer_id=actor.customer_id,
                query_text=query,
                only_forum_enabled=True,
            )
            _log_tool_call(actor, "list_companies", None, "ok")
            return companies
        finally:
            db.close()
    except ForumError as exc:
        _log_tool_call(actor, "list_companies", None, f"error:{type(exc).__name__}")
        raise ToolError(str(exc))


@mcp_server.tool(
    name="list_threads",
    description=(
        "Lista temas del foro ordenados por actividad reciente, incluyendo su autor. "
        "Puedes filtrar opcionalmente por company_id (entero), status ('open', 'in_progress', 'done', 'archived'), "
        "query (texto de búsqueda), page (por defecto 1) y page_size (por defecto 20, máximo 50)."
    ),
)
def list_threads(
    company_id: Optional[int] = None,
    status: Optional[str] = None,
    query: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    actor = _require_actor()
    try:
        check_mcp_rate_limit(actor.token_id, "read")
        db = SessionLocal()
        try:
            result = list_forum_threads(
                db,
                scoped_customer_id=actor.customer_id,
                only_active_customers=True,
                customer_id=company_id,
                status=status,
                query_text=query,
                page=page,
                page_size=page_size,
                max_page_size=50,
            )
            items = [
                {
                    "id": item["id"],
                    "company_id": item["customer_id"],
                    "company_name": item["company_name"],
                    "title": item["title"],
                    "status": item["status"],
                    "period_label": item["period_label"],
                    "due_at": _serialize_dt(item["due_at"]),
                    "author_name": item["author_name"],
                    "author_is_bot": item["author_is_bot"],
                    "posts_count": item["posts_count"],
                    "last_post_at": _serialize_dt(item["last_post_at"]),
                }
                for item in result["items"]
            ]
            _log_tool_call(actor, "list_threads", None, "ok")
            return {
                "items": items,
                "total": result["total"],
                "page": result["page"],
            }
        finally:
            db.close()
    except ForumError as exc:
        _log_tool_call(actor, "list_threads", None, f"error:{type(exc).__name__}")
        raise ToolError(str(exc))


def _serialize_mcp_post(p: dict[str, Any], include_replies: bool = False) -> dict[str, Any]:
    item: dict[str, Any] = {
        "id": p["id"],
        "parent_post_id": p["parent_post_id"],
        "author_name": p["author_name"],
        "author_is_bot": p["author_is_bot"],
        "body": p["body"],
        "created_at": _serialize_dt(p["created_at"]),
    }
    if include_replies:
        item["replies"] = [_serialize_mcp_post(r, include_replies=False) for r in p.get("replies", [])]
    return item


@mcp_server.tool(
    name="get_thread",
    description=(
        "Obtiene el detalle de un tema del foro con sus mensajes principales paginados en orden cronológico "
        "y las respuestas anidadas dentro del arreglo 'replies' de cada mensaje principal, identificando "
        "al autor de cada publicación. Parámetros: thread_id (entero requerido), page (por defecto 1) y "
        "page_size (por defecto 50, máximo 100)."
    ),
)
def get_thread(
    thread_id: int,
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    actor = _require_actor()
    try:
        check_mcp_rate_limit(actor.token_id, "read")
        db = SessionLocal()
        try:
            detail = get_thread_detail(
                db,
                thread_id,
                scoped_customer_id=actor.customer_id,
                only_active_customers=True,
                posts_page=page,
                posts_page_size=page_size,
                nested=True,
            )
            posts = [_serialize_mcp_post(p, include_replies=True) for p in detail["posts"]]
            _log_tool_call(actor, "get_thread", thread_id, "ok")
            return {
                "id": detail["id"],
                "company_name": detail["company_name"],
                "title": detail["title"],
                "body": detail["body"],
                "status": detail["status"],
                "period_label": detail["period_label"],
                "due_at": _serialize_dt(detail["due_at"]),
                "author_name": detail["author_name"],
                "author_is_bot": detail["author_is_bot"],
                "posts": posts,
                "posts_total": detail["posts_total"],
                "total_messages": detail["total_messages"],
                "posts_page": detail["posts_page"],
                "posts_page_size": detail["posts_page_size"],
                "has_more_posts": detail["has_more_posts"],
            }
        finally:
            db.close()
    except ForumError as exc:
        _log_tool_call(actor, "get_thread", thread_id, f"error:{type(exc).__name__}")
        raise ToolError(str(exc))


@mcp_server.tool(
    name="post_message",
    description=(
        "Publica un mensaje o respuesta en un tema abierto o en curso del foro y devuelve el mensaje completo creado. "
        "Parámetros: thread_id (entero), body (texto de 1 a 10,000 caracteres) y opcionalmente "
        "reply_to_post_id (entero para responder a un mensaje principal del mismo tema)."
    ),
)
def post_message(
    thread_id: int,
    body: str,
    reply_to_post_id: Optional[int] = None,
) -> dict[str, Any]:
    actor = _require_actor()
    try:
        check_mcp_rate_limit(actor.token_id, "write")
        db = SessionLocal()
        try:
            post = create_post(
                db,
                thread_id=thread_id,
                body=body,
                author_user_id=actor.user_id,
                is_bot=True,
                scoped_customer_id=actor.customer_id,
                parent_post_id=reply_to_post_id,
            )
            _log_tool_call(actor, "post_message", thread_id, "ok")
            return {
                "id": post["id"],
                "thread_id": post["thread_id"],
                "parent_post_id": post["parent_post_id"],
                "author_name": post["author_name"],
                "author_is_bot": post["author_is_bot"],
                "body": post["body"],
                "created_at": _serialize_dt(post["created_at"]),
            }
        finally:
            db.close()
    except ForumError as exc:
        _log_tool_call(actor, "post_message", thread_id, f"error:{type(exc).__name__}")
        raise ToolError(str(exc))


def _parse_optional_iso_dt(raw_dt: Optional[str]) -> Optional[datetime]:
    if raw_dt is None or not str(raw_dt).strip():
        return None
    try:
        parsed = datetime.fromisoformat(str(raw_dt).strip().replace("Z", "+00:00"))
    except ValueError:
        raise ToolError("Formato de fecha límite no válido. Usa formato ISO-8601 (ej. 2026-12-01T23:59:59).")
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


@mcp_server.tool(
    name="create_thread",
    description=(
        "Crea un nuevo tema en el foro asignado a una empresa. "
        "Parámetros requeridos: company_id (entero), title (3 a 200 caracteres) y body (1 a 10,000 caracteres). "
        "Opcionales: period_label (ej. 'Semana 48 2026') y due_at (fecha ISO-8601)."
    ),
)
def create_thread(
    company_id: int,
    title: str,
    body: str,
    period_label: Optional[str] = None,
    due_at: Optional[str] = None,
) -> dict[str, Any]:
    actor = _require_actor()
    if actor.customer_id is not None and company_id != actor.customer_id:
        _log_tool_call(actor, "create_thread", None, "error:ScopeDenied")
        raise ToolError("Empresa no encontrada o sin acceso.")

    parsed_due_at = _parse_optional_iso_dt(due_at)
    try:
        check_mcp_rate_limit(actor.token_id, "write")
        db = SessionLocal()
        try:
            created = create_forum_thread(
                db,
                customer_id=company_id,
                title=title,
                body=body,
                author_user_id=actor.user_id,
                period_label=period_label,
                due_at=parsed_due_at,
            )
            _log_tool_call(actor, "create_thread", created["id"], "ok")
            return {
                "id": created["id"],
                "company_id": created["customer_id"],
                "company_name": created["company_name"],
                "title": created["title"],
                "status": created["status"],
                "period_label": created["period_label"],
                "due_at": _serialize_dt(created["due_at"]),
                "author_name": created["author_name"],
                "author_is_bot": created["author_is_bot"],
                "created_at": _serialize_dt(created["created_at"]),
            }
        finally:
            db.close()
    except ForumError as exc:
        _log_tool_call(actor, "create_thread", None, f"error:{type(exc).__name__}")
        raise ToolError(str(exc))


def create_mcp_starlette_app():
    return mcp_server.streamable_http_app(
        streamable_http_path="/mcp",
        json_response=True,
        stateless_http=True,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )


class BotTokenAuthMiddleware:
    """Middleware ASGI que autentica tokens de bot antes de delegar al servidor MCP."""

    def __init__(self):
        self._app = create_mcp_starlette_app()

    def reset_app(self):
        self._app = create_mcp_starlette_app()
        return mcp_server.session_manager

    async def _send_json_error(self, send, status_code: int, detail: str) -> None:
        payload = json.dumps({"detail": detail}).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": status_code,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(payload)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": payload})

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        headers = {k.lower(): v for k, v in scope.get("headers", [])}
        raw_auth = headers.get(b"authorization", b"").decode("latin-1").strip()
        if not raw_auth.lower().startswith("bearer "):
            await self._send_json_error(send, 401, "Falta cabecera de autenticación Bearer.")
            return

        raw_token = raw_auth[7:].strip()
        db = SessionLocal()
        try:
            actor = authenticate_bot_token(db, raw_token)
        except BotTokenAuthError as exc:
            await self._send_json_error(send, exc.status_code, exc.message)
            return
        finally:
            db.close()

        token_ctx = _current_bot_actor.set(actor)
        try:
            await self._app(scope, receive, send)
        finally:
            _current_bot_actor.reset(token_ctx)


mcp_asgi_app = BotTokenAuthMiddleware()
