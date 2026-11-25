from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.api_token import ApiToken
from app.models.bot_profile import BotProfile
from app.models.user import User

BOT_TOKEN_PREFIX = "iqmx_bot_"


class BotTokenAuthError(Exception):
    """Error de autenticación o autorización para tokens de bot."""

    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class BotActor:
    user_id: int
    token_id: int
    name: str
    customer_id: Optional[int]


def hash_bot_token(raw_token: str) -> str:
    """Genera el hash SHA-256 hexadecimal del token de bot."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_and_store_bot_token(
    db: Session,
    bot_user_id: int,
    name: str,
    created_by_user_id: Optional[int],
    expires_at: Optional[datetime] = None,
) -> tuple[ApiToken, str]:
    """Genera un token opaco de larga vida para un bot y persiste únicamente su hash."""
    clean_name = name.strip()
    if len(clean_name) < 2:
        raise ValueError("El nombre del token debe tener al menos 2 caracteres.")

    raw_token = f"{BOT_TOKEN_PREFIX}{secrets.token_urlsafe(32)}"
    token_hash = hash_bot_token(raw_token)
    token_prefix = raw_token[:13]

    record = ApiToken(
        user_id=bot_user_id,
        name=clean_name,
        token_prefix=token_prefix,
        token_hash=token_hash,
        expires_at=expires_at,
        created_by_user_id=created_by_user_id,
        created_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record, raw_token


def authenticate_bot_token(db: Session, raw_token: str) -> BotActor:
    """Valida un token Bearer de bot contra api_tokens, rol 'bot' y bot_profiles."""
    if not raw_token or not raw_token.startswith(BOT_TOKEN_PREFIX):
        raise BotTokenAuthError("Token de bot no válido.", status_code=401)

    token_hash = hash_bot_token(raw_token)
    token_row = db.query(ApiToken).filter(ApiToken.token_hash == token_hash).first()
    if not token_row:
        raise BotTokenAuthError("Token de bot no válido.", status_code=401)

    now = datetime.utcnow()
    if token_row.revoked_at is not None:
        raise BotTokenAuthError("El token de bot fue revocado.", status_code=401)
    if token_row.expires_at is not None and token_row.expires_at <= now:
        raise BotTokenAuthError("El token de bot ha expirado.", status_code=401)

    user = db.query(User).filter(User.id == token_row.user_id).first()
    if not user or not user.has_role("bot"):
        raise BotTokenAuthError("La cuenta asociada no tiene rol de bot.", status_code=403)

    profile = db.query(BotProfile).filter(BotProfile.user_id == user.id).first()
    if not profile or not profile.is_active:
        raise BotTokenAuthError("El bot se encuentra pausado o inactivo.", status_code=403)

    # Actualizar last_used_at como máximo una vez por minuto para evitar escrituras excesivas
    if token_row.last_used_at is None or (now - token_row.last_used_at) >= timedelta(minutes=1):
        token_row.last_used_at = now
        db.commit()

    return BotActor(
        user_id=user.id,
        token_id=token_row.id,
        name=user.name,
        customer_id=profile.customer_id,
    )


def revoke_bot_token(db: Session, bot_user_id: int, token_id: int) -> Optional[ApiToken]:
    """Revoca inmediatamente un token perteneciente al bot indicado."""
    token_row = (
        db.query(ApiToken)
        .filter(ApiToken.id == token_id, ApiToken.user_id == bot_user_id)
        .first()
    )
    if not token_row:
        return None
    if token_row.revoked_at is None:
        token_row.revoked_at = datetime.utcnow()
        db.commit()
        db.refresh(token_row)
    return token_row
