from __future__ import annotations

import hashlib
import logging
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.config import settings
from app.lib.redis_client import get_redis_client
from app.models.bot_profile import BotProfile
from app.models.customer import Customer
from app.models.forum_attachment import ForumAttachment
from app.models.forum_post import ForumPost
from app.models.forum_thread import ForumThread
from app.models.role import Role
from app.models.user import User
from app.services.forum.storage import ForumStorageError, get_forum_storage

logger = logging.getLogger("uvicorn.error")

VALID_THREAD_STATUSES = ("open", "in_progress", "done", "archived")
BOT_WRITABLE_STATUSES = ("open", "in_progress")

ALLOWED_ATTACHMENT_EXTS: dict[str, str] = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".md": "text/markdown",
}
TEXT_ATTACHMENT_CONTENT_TYPES = {"text/csv", "text/plain", "text/markdown"}
INLINE_SAFE_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp", "application/pdf"}


def format_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Serializa un datetime en ISO-8601 UTC explícito con sufijo 'Z'."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt_utc = dt.replace(tzinfo=timezone.utc)
    else:
        dt_utc = dt.astimezone(timezone.utc)
    return dt_utc.isoformat().replace("+00:00", "Z")


class ForumError(Exception):
    """Base para errores de dominio del foro."""


class ForumNotFoundError(ForumError):
    pass


class ForumValidationError(ForumError):
    pass


class ForumPermissionError(ForumError):
    pass


class ForumRateLimitError(ForumError):
    pass


def _is_bot_user(user: Optional[User]) -> bool:
    return bool(user and user.has_role("bot"))


def _clean_body(body: str, max_chars: Optional[int] = None) -> str:
    limit = max_chars or settings.FORUM_MAX_BODY_CHARS
    if body is None:
        raise ForumValidationError("El contenido no puede estar vacío.")
    stripped = body.strip()
    if not stripped:
        raise ForumValidationError("El contenido no puede estar vacío.")
    if len(stripped) > limit:
        raise ForumValidationError(f"El contenido no puede exceder {limit} caracteres.")
    return stripped


def check_mcp_rate_limit(token_id: int, bucket: str) -> None:
    """Valida el límite de solicitudes por minuto en Redis (ventana fija)."""
    if bucket == "read":
        limit = settings.MCP_RATE_LIMIT_READ_PER_MIN
    elif bucket == "write":
        limit = settings.MCP_RATE_LIMIT_WRITE_PER_MIN
    else:
        raise ValueError(f"Bucket de límite desconocido: {bucket}")

    minute_slot = int(datetime.utcnow().timestamp() // 60)
    key = f"mcp_rl:{bucket}:{token_id}:{minute_slot}"

    try:
        r = get_redis_client()
        count = r.incr(key)
        if count == 1:
            r.expire(key, 90)
        if count > limit:
            raise ForumRateLimitError("Límite de solicitudes alcanzado, intenta más tarde")
    except ForumRateLimitError:
        raise
    except Exception as exc:
        logger.warning(f"Redis no disponible para rate limit MCP ({bucket}, token #{token_id}): {exc}")


def list_visible_companies(
    db: Session,
    scoped_customer_id: Optional[int] = None,
    query_text: Optional[str] = None,
    only_forum_enabled: bool = True,
) -> list[dict]:
    """Lista clientes activos visibles (y habilitados en el foro por defecto) para el actor."""
    query = db.query(Customer).filter(Customer.is_active.is_(True))
    if only_forum_enabled:
        query = query.filter(Customer.forum_enabled.is_(True))
    if scoped_customer_id is not None:
        query = query.filter(Customer.id == scoped_customer_id)
    if query_text and query_text.strip():
        query = query.filter(Customer.company_name.ilike(f"%{query_text.strip()}%"))
    rows = query.order_by(Customer.company_name.asc()).all()
    return [{"id": c.id, "company_name": c.company_name} for c in rows]


def _base_threads_query(
    db: Session,
    scoped_customer_id: Optional[int],
    only_active_customers: bool,
):
    query = (
        db.query(ForumThread, Customer, User)
        .join(Customer, ForumThread.customer_id == Customer.id)
        .join(User, ForumThread.author_user_id == User.id)
        .filter(ForumThread.deleted_at.is_(None))
    )
    if only_active_customers:
        query = query.filter(Customer.is_active.is_(True), Customer.forum_enabled.is_(True))
    if scoped_customer_id is not None:
        query = query.filter(ForumThread.customer_id == scoped_customer_id)
    return query


def _post_counts_by_thread(db: Session, thread_ids: list[int]) -> dict[int, int]:
    if not thread_ids:
        return {}
    rows = (
        db.query(ForumPost.thread_id, func.count(ForumPost.id))
        .filter(ForumPost.thread_id.in_(thread_ids), ForumPost.deleted_at.is_(None))
        .group_by(ForumPost.thread_id)
        .all()
    )
    return {tid: count for tid, count in rows}


def list_threads(
    db: Session,
    *,
    scoped_customer_id: Optional[int] = None,
    only_active_customers: bool = False,
    customer_id: Optional[int] = None,
    status: Optional[str] = None,
    query_text: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    max_page_size: int = 100,
) -> dict:
    """Lista temas paginados y ordenados por actividad reciente."""
    safe_page = max(1, page)
    safe_size = max(1, min(page_size, max_page_size))

    if status and status not in VALID_THREAD_STATUSES:
        raise ForumValidationError("Estado de tema no válido.")

    q = _base_threads_query(db, scoped_customer_id=scoped_customer_id, only_active_customers=only_active_customers)

    if customer_id is not None:
        if scoped_customer_id is not None and customer_id != scoped_customer_id:
            return {"items": [], "total": 0, "page": safe_page, "page_size": safe_size}
        q = q.filter(ForumThread.customer_id == customer_id)

    if status:
        q = q.filter(ForumThread.status == status)

    if query_text and query_text.strip():
        pattern = f"%{query_text.strip()}%"
        q = q.filter(or_(ForumThread.title.ilike(pattern), ForumThread.body.ilike(pattern)))

    total = q.count()
    rows = (
        q.order_by(
            func.coalesce(ForumThread.last_post_at, ForumThread.created_at).desc(),
            ForumThread.id.desc(),
        )
        .offset((safe_page - 1) * safe_size)
        .limit(safe_size)
        .all()
    )

    counts = _post_counts_by_thread(db, [t.id for t, _, _ in rows])
    items = []
    for thread, customer, author in rows:
        items.append({
            "id": thread.id,
            "customer_id": thread.customer_id,
            "company_name": customer.company_name,
            "title": thread.title,
            "status": thread.status,
            "period_label": thread.period_label,
            "due_at": thread.due_at,
            "author_name": author.name,
            "author_is_bot": _is_bot_user(author),
            "posts_count": counts.get(thread.id, 0),
            "last_post_at": thread.last_post_at,
            "created_at": thread.created_at,
        })

    return {
        "items": items,
        "total": total,
        "page": safe_page,
        "page_size": safe_size,
    }


def get_thread_detail(
    db: Session,
    thread_id: int,
    *,
    scoped_customer_id: Optional[int] = None,
    only_active_customers: bool = False,
    posts_page: Optional[int] = None,
    posts_page_size: Optional[int] = None,
    nested: bool = False,
) -> dict:
    """Obtiene el detalle del tema y sus mensajes en orden cronológico (con paginación opcional)."""
    row = (
        _base_threads_query(db, scoped_customer_id=scoped_customer_id, only_active_customers=only_active_customers)
        .filter(ForumThread.id == thread_id)
        .first()
    )
    if not row:
        raise ForumNotFoundError("Tema no encontrado.")

    thread, customer, author = row
    post_rows = (
        db.query(ForumPost, User)
        .join(User, ForumPost.author_user_id == User.id)
        .filter(ForumPost.thread_id == thread.id)
        .order_by(ForumPost.created_at.asc(), ForumPost.id.asc())
        .all()
    )

    active_reply_parents = {
        p.parent_post_id
        for p, _ in post_rows
        if p.parent_post_id is not None and p.deleted_at is None
    }

    posts_payload = []
    for post, post_author in post_rows:
        is_deleted = post.deleted_at is not None
        if is_deleted and post.id not in active_reply_parents:
            continue
        posts_payload.append({
            "id": post.id,
            "parent_post_id": post.parent_post_id,
            "body": "Mensaje eliminado" if is_deleted else post.body,
            "author_user_id": post.author_user_id,
            "author_name": post_author.name,
            "author_is_bot": _is_bot_user(post_author),
            "created_at": post.created_at,
            "updated_at": post.updated_at,
            "deleted": is_deleted,
            "attachments": [],
        })

    attachment_rows = (
        db.query(ForumAttachment)
        .filter(ForumAttachment.thread_id == thread.id, ForumAttachment.deleted_at.is_(None))
        .order_by(ForumAttachment.created_at.asc(), ForumAttachment.id.asc())
        .all()
    )
    thread_attachments: list[dict] = []
    attachments_by_post: dict[int, list[dict]] = {}
    for att in attachment_rows:
        att_dict = _serialize_attachment(att)
        if att.post_id is None:
            thread_attachments.append(att_dict)
        else:
            attachments_by_post.setdefault(att.post_id, []).append(att_dict)

    for post_item in posts_payload:
        post_item["attachments"] = attachments_by_post.get(post_item["id"], [])

    total_messages = len(posts_payload)

    if nested:
        replies_by_parent: dict[int, list[dict]] = {}
        root_posts: list[dict] = []
        for item in posts_payload:
            if item["parent_post_id"] is None:
                root_posts.append(item)
            else:
                replies_by_parent.setdefault(item["parent_post_id"], []).append(item)
        target_posts = [
            {**root, "replies": replies_by_parent.get(root["id"], [])}
            for root in root_posts
        ]
    else:
        target_posts = posts_payload

    posts_total = len(target_posts)
    if posts_page is not None or posts_page_size is not None:
        safe_page = max(1, posts_page or 1)
        safe_size = max(1, min(posts_page_size or 50, 100))
        start = (safe_page - 1) * safe_size
        end = start + safe_size
        paged_posts = target_posts[start:end]
        has_more = end < posts_total
    else:
        safe_page = 1
        safe_size = posts_total
        paged_posts = target_posts
        has_more = False

    return {
        "id": thread.id,
        "customer_id": thread.customer_id,
        "company_name": customer.company_name,
        "title": thread.title,
        "body": thread.body,
        "status": thread.status,
        "period_label": thread.period_label,
        "due_at": thread.due_at,
        "author_user_id": thread.author_user_id,
        "author_name": author.name,
        "author_is_bot": _is_bot_user(author),
        "last_post_at": thread.last_post_at,
        "created_at": thread.created_at,
        "updated_at": thread.updated_at,
        "attachments": thread_attachments,
        "posts": paged_posts,
        "posts_total": posts_total,
        "total_messages": total_messages,
        "posts_page": safe_page,
        "posts_page_size": safe_size,
        "has_more_posts": has_more,
    }


def create_thread(
    db: Session,
    *,
    customer_id: int,
    title: str,
    body: str,
    author_user_id: int,
    period_label: Optional[str] = None,
    due_at: Optional[datetime] = None,
) -> dict:
    """Crea un nuevo tema en el foro asignado a una empresa habilitada."""
    customer = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id,
            Customer.is_active.is_(True),
            Customer.forum_enabled.is_(True),
        )
        .first()
    )
    if not customer:
        raise ForumNotFoundError("Empresa no encontrada o no habilitada en el foro.")

    clean_title = (title or "").strip()
    if len(clean_title) < 3 or len(clean_title) > 200:
        raise ForumValidationError("El título debe tener entre 3 y 200 caracteres.")

    clean_body = _clean_body(body)
    clean_period = period_label.strip() if period_label and period_label.strip() else None
    if clean_period and len(clean_period) > 50:
        raise ForumValidationError("El periodo no puede exceder 50 caracteres.")

    now = datetime.utcnow()
    thread = ForumThread(
        customer_id=customer.id,
        title=clean_title,
        body=clean_body,
        status="open",
        period_label=clean_period,
        due_at=due_at,
        author_user_id=author_user_id,
        last_post_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return get_thread_detail(db, thread.id)


def update_thread(
    db: Session,
    thread_id: int,
    *,
    title: Optional[str] = None,
    body: Optional[str] = None,
    status: Optional[str] = None,
    period_label: Optional[str] = None,
    due_at: Optional[datetime] = None,
    fields_set: Optional[set[str]] = None,
) -> dict:
    """Actualiza un tema existente o cambia su estado."""
    thread = db.query(ForumThread).filter(ForumThread.id == thread_id, ForumThread.deleted_at.is_(None)).first()
    if not thread:
        raise ForumNotFoundError("Tema no encontrado.")

    fields = fields_set if fields_set is not None else set()

    if title is not None:
        clean_title = title.strip()
        if len(clean_title) < 3 or len(clean_title) > 200:
            raise ForumValidationError("El título debe tener entre 3 y 200 caracteres.")
        thread.title = clean_title

    if body is not None:
        thread.body = _clean_body(body)

    if status is not None:
        if status not in VALID_THREAD_STATUSES:
            raise ForumValidationError("Estado de tema no válido.")
        thread.status = status

    if "period_label" in fields or period_label is not None:
        clean_period = period_label.strip() if period_label and period_label.strip() else None
        if clean_period and len(clean_period) > 50:
            raise ForumValidationError("El periodo no puede exceder 50 caracteres.")
        thread.period_label = clean_period

    if "due_at" in fields or due_at is not None:
        thread.due_at = due_at

    thread.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(thread)
    return get_thread_detail(db, thread.id)


def soft_delete_thread(db: Session, thread_id: int) -> None:
    """Marca un tema como eliminado (borrado lógico)."""
    thread = db.query(ForumThread).filter(ForumThread.id == thread_id, ForumThread.deleted_at.is_(None)).first()
    if not thread:
        raise ForumNotFoundError("Tema no encontrado.")
    thread.deleted_at = datetime.utcnow()
    db.commit()


def create_post(
    db: Session,
    *,
    thread_id: int,
    body: str,
    author_user_id: int,
    is_bot: bool,
    scoped_customer_id: Optional[int] = None,
    parent_post_id: Optional[int] = None,
) -> dict:
    """Publica un mensaje o respuesta en un tema del foro."""
    query = (
        db.query(ForumThread, Customer)
        .join(Customer, ForumThread.customer_id == Customer.id)
        .filter(ForumThread.id == thread_id, ForumThread.deleted_at.is_(None))
    )
    if is_bot:
        query = query.filter(Customer.is_active.is_(True), Customer.forum_enabled.is_(True))
    if scoped_customer_id is not None:
        query = query.filter(ForumThread.customer_id == scoped_customer_id)

    row = query.first()
    if not row:
        raise ForumNotFoundError("Tema no encontrado.")

    thread, _ = row

    if is_bot:
        if thread.status not in BOT_WRITABLE_STATUSES:
            raise ForumValidationError("Solo es posible comentar en temas abiertos o en curso.")
    else:
        if thread.status == "archived":
            raise ForumValidationError("No se pueden agregar mensajes a un tema archivado.")

    clean_body = _clean_body(body)

    if parent_post_id is not None:
        parent = (
            db.query(ForumPost)
            .filter(
                ForumPost.id == parent_post_id,
                ForumPost.thread_id == thread.id,
                ForumPost.deleted_at.is_(None),
            )
            .first()
        )
        if not parent:
            raise ForumValidationError("El mensaje al que intentas responder no existe en este tema.")
        if parent.parent_post_id is not None:
            raise ForumValidationError("Solo se permite un nivel de respuesta en los mensajes.")

    now = datetime.utcnow()
    post = ForumPost(
        thread_id=thread.id,
        parent_post_id=parent_post_id,
        body=clean_body,
        author_user_id=author_user_id,
        created_at=now,
        updated_at=now,
    )
    thread.last_post_at = now
    thread.updated_at = now
    db.add(post)
    db.commit()
    db.refresh(post)

    author = db.query(User).filter(User.id == author_user_id).first()
    return {
        "id": post.id,
        "thread_id": post.thread_id,
        "parent_post_id": post.parent_post_id,
        "body": post.body,
        "author_user_id": post.author_user_id,
        "author_name": author.name if author else "Usuario",
        "author_is_bot": _is_bot_user(author),
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "deleted": False,
    }


def update_post(
    db: Session,
    *,
    post_id: int,
    body: str,
    editor_user_id: int,
) -> dict:
    """Edita un mensaje (solo permitido para el autor humano administrador)."""
    post = db.query(ForumPost).filter(ForumPost.id == post_id, ForumPost.deleted_at.is_(None)).first()
    if not post:
        raise ForumNotFoundError("Mensaje no encontrado.")
    if post.author_user_id != editor_user_id:
        raise ForumPermissionError("Solo puedes editar tus propios mensajes.")

    post.body = _clean_body(body)
    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)

    author = db.query(User).filter(User.id == post.author_user_id).first()
    return {
        "id": post.id,
        "parent_post_id": post.parent_post_id,
        "body": post.body,
        "author_user_id": post.author_user_id,
        "author_name": author.name if author else "Usuario",
        "author_is_bot": _is_bot_user(author),
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "deleted": False,
    }


def soft_delete_post(db: Session, post_id: int) -> None:
    """Borrado lógico de un mensaje por un administrador."""
    post = db.query(ForumPost).filter(ForumPost.id == post_id, ForumPost.deleted_at.is_(None)).first()
    if not post:
        raise ForumNotFoundError("Mensaje no encontrado.")
    post.deleted_at = datetime.utcnow()
    db.commit()


def _sanitize_filename(raw_name: str) -> str:
    base = Path(raw_name or "archivo").name
    cleaned = re.sub(r"[^a-zA-Z0-9._\-\s()]", "_", base).strip()
    if not cleaned:
        cleaned = "archivo"
    return cleaned[:200]


def _validate_magic_bytes(ext: str, data: bytes) -> None:
    if ext == ".png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ForumValidationError("El contenido del archivo no corresponde a una imagen PNG válida.")
    if ext in (".jpg", ".jpeg") and not data.startswith(b"\xff\xd8\xff"):
        raise ForumValidationError("El contenido del archivo no corresponde a una imagen JPEG válida.")
    if ext == ".webp" and not (len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"):
        raise ForumValidationError("El contenido del archivo no corresponde a una imagen WebP válida.")
    if ext == ".pdf" and not data.startswith(b"%PDF-"):
        raise ForumValidationError("El contenido del archivo no corresponde a un PDF válido.")
    if ext in (".docx", ".xlsx") and not data.startswith(b"PK\x03\x04"):
        raise ForumValidationError("El contenido del archivo no corresponde a un documento Office válido.")
    if ext in (".txt", ".md", ".csv"):
        if b"\x00" in data[:4096]:
            raise ForumValidationError("El archivo de texto contiene datos binarios no permitidos.")
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            try:
                data.decode("latin-1")
            except UnicodeDecodeError:
                raise ForumValidationError("No fue posible decodificar el archivo de texto.")


def _serialize_attachment(att: ForumAttachment) -> dict:
    return {
        "id": att.id,
        "thread_id": att.thread_id,
        "post_id": att.post_id,
        "filename": att.original_filename,
        "content_type": att.content_type,
        "size_bytes": att.size_bytes,
        "created_at": att.created_at,
    }


def create_attachment(
    db: Session,
    *,
    thread_id: int,
    post_id: Optional[int],
    filename: str,
    content_type: Optional[str],
    data: bytes,
    uploaded_by_user_id: int,
    is_bot: bool = False,
    scoped_customer_id: Optional[int] = None,
) -> dict:
    """Valida, guarda en almacenamiento y registra un adjunto del foro."""
    query = (
        db.query(ForumThread, Customer)
        .join(Customer, ForumThread.customer_id == Customer.id)
        .filter(ForumThread.id == thread_id, ForumThread.deleted_at.is_(None))
    )
    if is_bot:
        query = query.filter(Customer.is_active.is_(True), Customer.forum_enabled.is_(True))
    if scoped_customer_id is not None:
        query = query.filter(ForumThread.customer_id == scoped_customer_id)

    row = query.first()
    if not row:
        raise ForumNotFoundError("Tema no encontrado.")

    thread, _ = row
    if is_bot and thread.status not in BOT_WRITABLE_STATUSES:
        raise ForumValidationError("Solo es posible adjuntar archivos en temas abiertos o en curso.")

    if post_id is not None:
        post = (
            db.query(ForumPost)
            .filter(ForumPost.id == post_id, ForumPost.thread_id == thread_id, ForumPost.deleted_at.is_(None))
            .first()
        )
        if not post:
            raise ForumNotFoundError("Mensaje no encontrado en este tema.")

    if not data:
        raise ForumValidationError("El archivo está vacío.")

    max_bytes = settings.FORUM_MAX_FILE_SIZE_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise ForumValidationError(f"El archivo excede el límite máximo de {settings.FORUM_MAX_FILE_SIZE_MB} MB.")

    safe_name = _sanitize_filename(filename)
    ext = Path(safe_name).suffix.lower()
    canonical_mime = ALLOWED_ATTACHMENT_EXTS.get(ext)
    if not canonical_mime:
        allowed_list = ", ".join(sorted(ALLOWED_ATTACHMENT_EXTS.keys()))
        raise ForumValidationError(f"Tipo de archivo no permitido ({ext or 'sin extensión'}). Permitidos: {allowed_list}")

    _validate_magic_bytes(ext, data)

    existing_count_q = db.query(func.count(ForumAttachment.id)).filter(
        ForumAttachment.thread_id == thread_id,
        ForumAttachment.deleted_at.is_(None),
    )
    if post_id is None:
        existing_count_q = existing_count_q.filter(ForumAttachment.post_id.is_(None))
    else:
        existing_count_q = existing_count_q.filter(ForumAttachment.post_id == post_id)

    existing_count = existing_count_q.scalar() or 0
    if existing_count >= settings.FORUM_MAX_ATTACHMENTS_PER_ITEM:
        raise ForumValidationError(
            f"Se alcanzó el límite máximo de {settings.FORUM_MAX_ATTACHMENTS_PER_ITEM} archivos adjuntos."
        )

    sha256_hex = hashlib.sha256(data).hexdigest()
    now = datetime.utcnow()
    stored_key = f"threads/{thread_id}/{secrets.token_hex(16)}{ext}"

    storage = get_forum_storage()
    try:
        storage.save(stored_key, data)
    except ForumStorageError as exc:
        raise ForumValidationError(str(exc))

    attachment = ForumAttachment(
        thread_id=thread_id,
        post_id=post_id,
        original_filename=safe_name,
        stored_key=stored_key,
        content_type=canonical_mime,
        size_bytes=len(data),
        sha256=sha256_hex,
        uploaded_by_user_id=uploaded_by_user_id,
        created_at=now,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return _serialize_attachment(attachment)


def get_attachment_for_download(
    db: Session,
    attachment_id: int,
    *,
    scoped_customer_id: Optional[int] = None,
    only_active_customers: bool = False,
) -> tuple[dict, bytes]:
    """Obtiene metadatos y bytes de un adjunto validando acceso por empresa."""
    q = (
        db.query(ForumAttachment, ForumThread, Customer)
        .join(ForumThread, ForumAttachment.thread_id == ForumThread.id)
        .join(Customer, ForumThread.customer_id == Customer.id)
        .filter(
            ForumAttachment.id == attachment_id,
            ForumAttachment.deleted_at.is_(None),
            ForumThread.deleted_at.is_(None),
        )
    )
    if only_active_customers:
        q = q.filter(Customer.is_active.is_(True), Customer.forum_enabled.is_(True))
    if scoped_customer_id is not None:
        q = q.filter(ForumThread.customer_id == scoped_customer_id)

    row = q.first()
    if not row:
        raise ForumNotFoundError("Archivo adjunto no encontrado.")

    att, _, _ = row
    if att.post_id is not None:
        post = (
            db.query(ForumPost)
            .filter(ForumPost.id == att.post_id, ForumPost.deleted_at.is_(None))
            .first()
        )
        if not post:
            raise ForumNotFoundError("El mensaje asociado a este archivo fue eliminado.")

    storage = get_forum_storage()
    try:
        data = storage.read(att.stored_key)
    except FileNotFoundError:
        raise ForumNotFoundError("El archivo físico no se encuentra disponible.")

    return _serialize_attachment(att), data


def soft_delete_attachment(db: Session, attachment_id: int) -> None:
    """Marca un adjunto como eliminado y borra el archivo físico."""
    att = (
        db.query(ForumAttachment)
        .filter(ForumAttachment.id == attachment_id, ForumAttachment.deleted_at.is_(None))
        .first()
    )
    if not att:
        raise ForumNotFoundError("Archivo adjunto no encontrado.")
    att.deleted_at = datetime.utcnow()
    db.commit()
    try:
        get_forum_storage().delete(att.stored_key)
    except Exception as exc:
        logger.warning(f"No se pudo eliminar el archivo físico {att.stored_key}: {exc}")
