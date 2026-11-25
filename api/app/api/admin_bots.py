from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.admin_auth import get_current_admin
from app.db.database import get_db
from app.lib.security import hash_password
from app.models.api_token import ApiToken
from app.models.bot_profile import BotProfile
from app.models.customer import Customer
from app.models.role import Role
from app.models.user import User
from app.services.bots.tokens import generate_and_store_bot_token, revoke_bot_token

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/bots", tags=["admin-bots"])


class BotResponse(BaseModel):
    id: int
    name: str
    email: str
    customer_id: Optional[int] = None
    company_name: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    tokens_active: int
    created_at: datetime


class CreateBotRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    customer_id: Optional[int] = None


class UpdateBotRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    customer_id: Optional[int] = None
    is_active: Optional[bool] = None


class BotTokenResponse(BaseModel):
    id: int
    name: str
    token_prefix: str
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    created_at: datetime


class CreateBotTokenRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    expires_at: Optional[datetime] = None


class CreateBotTokenResponse(BaseModel):
    id: int
    name: str
    token: str
    token_prefix: str
    expires_at: Optional[datetime] = None
    created_at: datetime


def _get_bot_or_404(db: Session, bot_id: int) -> tuple[User, BotProfile]:
    user = db.query(User).filter(User.id == bot_id).first()
    if not user or not user.has_role("bot"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot no encontrado.")
    profile = db.query(BotProfile).filter(BotProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil de bot no encontrado.")
    return user, profile


def _build_bot_response(db: Session, user: User, profile: BotProfile) -> BotResponse:
    company_name = None
    if profile.customer_id is not None:
        cust = db.query(Customer).filter(Customer.id == profile.customer_id).first()
        company_name = cust.company_name if cust else None

    now = datetime.utcnow()
    tokens_active = (
        db.query(ApiToken)
        .filter(
            ApiToken.user_id == user.id,
            ApiToken.revoked_at.is_(None),
            (ApiToken.expires_at.is_(None) | (ApiToken.expires_at > now)),
        )
        .count()
    )

    return BotResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        customer_id=profile.customer_id,
        company_name=company_name,
        description=profile.description,
        is_active=profile.is_active,
        tokens_active=tokens_active,
        created_at=profile.created_at,
    )


@router.get("", response_model=List[BotResponse])
@router.get("/", response_model=List[BotResponse], include_in_schema=False)
def list_bots(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Lista las cuentas de bot registradas junto con su empresa asignada y conteo de tokens."""
    rows = (
        db.query(User, BotProfile, Customer)
        .join(BotProfile, BotProfile.user_id == User.id)
        .outerjoin(Customer, BotProfile.customer_id == Customer.id)
        .order_by(User.id.asc())
        .all()
    )
    user_ids = [user.id for user, _, _ in rows]
    tokens_map: dict[int, int] = {}
    if user_ids:
        now = datetime.utcnow()
        counts = (
            db.query(ApiToken.user_id, func.count(ApiToken.id))
            .filter(
                ApiToken.user_id.in_(user_ids),
                ApiToken.revoked_at.is_(None),
                (ApiToken.expires_at.is_(None) | (ApiToken.expires_at > now)),
            )
            .group_by(ApiToken.user_id)
            .all()
        )
        tokens_map = {uid: cnt for uid, cnt in counts}

    return [
        BotResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            customer_id=profile.customer_id,
            company_name=customer.company_name if customer else None,
            description=profile.description,
            is_active=profile.is_active,
            tokens_active=tokens_map.get(user.id, 0),
            created_at=profile.created_at,
        )
        for user, profile, customer in rows
    ]


@router.post("", response_model=BotResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=BotResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_bot(
    req: CreateBotRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Crea un usuario con rol 'bot' y su perfil operativo opcionalmente ligado a una empresa."""
    clean_name = req.name.strip()
    if len(clean_name) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El nombre del bot es obligatorio.")

    if req.customer_id is not None:
        cust = db.query(Customer).filter(Customer.id == req.customer_id).first()
        if not cust:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La empresa seleccionada no existe.")

    bot_role = db.query(Role).filter(Role.name == "bot").first()
    if not bot_role:
        bot_role = Role(name="bot")
        db.add(bot_role)
        db.commit()
        db.refresh(bot_role)

    tech_email = f"bot-{secrets.token_hex(6)}@bots.iqissmexico.local"
    unusable_pw = hash_password(secrets.token_urlsafe(32))

    user = User(
        name=clean_name,
        email=tech_email,
        password_hash=unusable_pw,
        role_id=bot_role.id,
        partner_id=None,
    )
    user.roles.append(bot_role)
    db.add(user)
    db.flush()

    now = datetime.utcnow()
    clean_desc = req.description.strip() if req.description and req.description.strip() else None
    profile = BotProfile(
        user_id=user.id,
        customer_id=req.customer_id,
        description=clean_desc,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)
    db.refresh(profile)

    logger.info(f"Bot #{user.id} ('{user.name}') creado por admin #{admin.id}")
    return _build_bot_response(db, user, profile)


@router.patch("/{bot_id}", response_model=BotResponse)
def update_bot(
    bot_id: int,
    req: UpdateBotRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Actualiza nombre, descripción, empresa asignada (null = todas) o estado de un bot."""
    user, profile = _get_bot_or_404(db, bot_id)

    if "name" in req.model_fields_set and req.name is not None:
        clean_name = req.name.strip()
        if len(clean_name) < 2:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El nombre del bot no puede estar vacío.")
        user.name = clean_name

    if "description" in req.model_fields_set:
        profile.description = req.description.strip() if req.description and req.description.strip() else None

    if "customer_id" in req.model_fields_set:
        if req.customer_id is None:
            profile.customer_id = None
        else:
            cust = db.query(Customer).filter(Customer.id == req.customer_id).first()
            if not cust:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La empresa seleccionada no existe.")
            profile.customer_id = cust.id

    if "is_active" in req.model_fields_set and req.is_active is not None:
        profile.is_active = req.is_active

    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    db.refresh(profile)
    return _build_bot_response(db, user, profile)


@router.get("/{bot_id}/tokens", response_model=List[BotTokenResponse])
def list_bot_tokens(
    bot_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Lista las credenciales emitidas para un bot (sin exponer los secretos)."""
    user, _ = _get_bot_or_404(db, bot_id)
    rows = (
        db.query(ApiToken)
        .filter(ApiToken.user_id == user.id)
        .order_by(ApiToken.created_at.desc(), ApiToken.id.desc())
        .all()
    )
    return [
        BotTokenResponse(
            id=t.id,
            name=t.name,
            token_prefix=t.token_prefix,
            expires_at=t.expires_at,
            last_used_at=t.last_used_at,
            revoked_at=t.revoked_at,
            created_at=t.created_at,
        )
        for t in rows
    ]


@router.post("/{bot_id}/tokens", response_model=CreateBotTokenResponse, status_code=status.HTTP_201_CREATED)
def create_bot_token(
    bot_id: int,
    req: CreateBotTokenRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Genera un nuevo token de acceso para el bot. El secreto solo se retorna en esta respuesta."""
    user, _ = _get_bot_or_404(db, bot_id)

    expires_at_naive: Optional[datetime] = None
    if req.expires_at is not None:
        dt = req.expires_at
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        if dt <= datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La fecha de vencimiento debe ser posterior al momento actual.",
            )
        expires_at_naive = dt

    try:
        record, raw_token = generate_and_store_bot_token(
            db=db,
            bot_user_id=user.id,
            name=req.name,
            created_by_user_id=admin.id,
            expires_at=expires_at_naive,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    logger.info(f"Token #{record.id} ({record.token_prefix}...) emitido para bot #{user.id} por admin #{admin.id}")
    return CreateBotTokenResponse(
        id=record.id,
        name=record.name,
        token=raw_token,
        token_prefix=record.token_prefix,
        expires_at=record.expires_at,
        created_at=record.created_at,
    )


@router.post("/{bot_id}/tokens/{token_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
def revoke_token_endpoint(
    bot_id: int,
    token_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Revoca inmediatamente un token de bot."""
    user, _ = _get_bot_or_404(db, bot_id)
    revoked = revoke_bot_token(db, bot_user_id=user.id, token_id=token_id)
    if not revoked:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token no encontrado para este bot.")
    logger.info(f"Token #{token_id} de bot #{user.id} revocado por admin #{admin.id}")
    return None
