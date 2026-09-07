import logging
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.role import Role
from app.lib.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])

EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"

# --- Dependencia de Administrador ---
async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Valida que el usuario autenticado tenga el rol 'admin'."""
    if not current_user.has_role("admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido únicamente a administradores del sistema."
        )
    return current_user

# --- Schemas ---

class AdminStatusResponse(BaseModel):
    setup_required: bool
    admin_count: int

class AdminSetupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=8, max_length=100)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(EMAIL_REGEX, clean):
            raise ValueError("El correo electrónico no tiene un formato válido.")
        return clean

class AdminLoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=150)
    password: str

class AdminProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    telegram_chat_id: Optional[str] = None

class UpdateAdminProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    password: Optional[str] = Field(None, min_length=8, max_length=100)
    telegram_chat_id: Optional[str] = None

class AdminAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AdminProfileResponse

# --- Endpoints ---

@router.get("/status", response_model=AdminStatusResponse)
def get_admin_status(db: Session = Depends(get_db)):
    """
    Indica si el sistema requiere configuración inicial (onboarding del primer super-admin).
    Si no existe ningún admin registrado, setup_required es True.
    """
    admin_role = db.query(Role).filter(Role.name == "admin").first()
    if not admin_role:
        return AdminStatusResponse(setup_required=True, admin_count=0)
    
    # Contar usuarios con rol admin (relación directa o en user_has_role)
    admin_count = db.query(User).filter(
        (User.role_id == admin_role.id) | (User.roles.any(Role.name == "admin"))
    ).count()

    return AdminStatusResponse(
        setup_required=(admin_count == 0),
        admin_count=admin_count
    )

@router.post("/setup", response_model=AdminAuthResponse)
def setup_first_admin(
    req: AdminSetupRequest,
    db: Session = Depends(get_db)
):
    """
    Registra el primer administrador del sistema (Onboarding Bootstrap).
    Este endpoint se deshabilita y bloquea PERMANENTEMENTE en cuanto existe al menos 1 administrador.
    """
    admin_role = db.query(Role).filter(Role.name == "admin").first()
    if not admin_role:
        admin_role = Role(name="admin")
        db.add(admin_role)
        db.commit()
        db.refresh(admin_role)

    # Verificar si ya existe algún administrador
    admin_count = db.query(User).filter(
        (User.role_id == admin_role.id) | (User.roles.any(Role.name == "admin"))
    ).count()

    if admin_count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El sistema ya cuenta con administradores registrados. El registro inicial está cerrado."
        )

    # Verificar si el correo ya existe
    clean_email = req.email.strip().lower()
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con este correo electrónico."
        )

    # Crear el Super-Admin
    new_admin = User(
        name=req.name.strip(),
        email=clean_email,
        password_hash=hash_password(req.password),
        role_id=admin_role.id
    )
    new_admin.roles.append(admin_role)
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    logger.info(f"🎉 Super-Admin inicial configurado exitosamente: {new_admin.email} (User #{new_admin.id})")

    token = create_access_token(data={
        "sub": str(new_admin.id),
        "user_id": new_admin.id,
        "email": new_admin.email,
        "role": "admin"
    })

    return AdminAuthResponse(
        access_token=token,
        user=AdminProfileResponse(
            id=new_admin.id,
            name=new_admin.name,
            email=new_admin.email,
            role="admin"
        )
    )

@router.post("/login", response_model=AdminAuthResponse)
def login_admin(
    req: AdminLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Inicio de sesión para administradores del portal central.
    Verifica que el usuario tenga el rol 'admin'.
    """
    clean_email = req.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo electrónico o contraseña incorrectos."
        )

    if not user.has_role("admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta no tiene privilegios de administrador."
        )

    token = create_access_token(data={
        "sub": str(user.id),
        "user_id": user.id,
        "email": user.email,
        "role": "admin"
    })

    return AdminAuthResponse(
        access_token=token,
        user=AdminProfileResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            role="admin"
        )
    )

@router.get("/me", response_model=AdminProfileResponse)
def get_admin_profile(
    current_admin: User = Depends(get_current_admin)
):
    """Retorna el perfil del administrador autenticado."""
    return AdminProfileResponse(
        id=current_admin.id,
        name=current_admin.name,
        email=current_admin.email,
        role=current_admin.role_name or "admin",
        telegram_chat_id=current_admin.telegram_chat_id
    )

@router.patch("/me", response_model=AdminProfileResponse)
def update_admin_profile(
    req: UpdateAdminProfileRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Actualiza datos del perfil del administrador autenticado (nombre, contraseña, telegram_chat_id)."""
    if req.name is not None and req.name.strip():
        current_admin.name = req.name.strip()
    if req.password is not None and req.password.strip():
        current_admin.password_hash = hash_password(req.password.strip())
    if req.telegram_chat_id is not None:
        clean_tg = req.telegram_chat_id.strip()
        current_admin.telegram_chat_id = clean_tg if clean_tg else None

    db.commit()
    db.refresh(current_admin)

    logger.info(f"Perfil de administrador actualizado: #{current_admin.id} ({current_admin.email})")

    return AdminProfileResponse(
        id=current_admin.id,
        name=current_admin.name,
        email=current_admin.email,
        role=current_admin.role_name or "admin",
        telegram_chat_id=current_admin.telegram_chat_id
    )

@router.post("/me/test-telegram")
def test_my_telegram_notification(
    current_admin: User = Depends(get_current_admin)
):
    """
    Envía un mensaje de prueba al telegram_chat_id del administrador autenticado.
    """
    if not current_admin.telegram_chat_id or not current_admin.telegram_chat_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tienes un Telegram Chat ID configurado en tu perfil."
        )

    msg = (
        f"🤖 *¡Prueba de Notificación Exitosa!* 🚀\n\n"
        f"Hola *{current_admin.name}*, tu cuenta de IQISSMexico ha sido vinculada "
        f"correctamente a este chat de Telegram.\n\n"
        f"A partir de este momento recibirás alertas operativas importantes en tiempo real."
    )

    from app.services.notifications.telegram import send_telegram_message
    res = send_telegram_message(
        chat_id=current_admin.telegram_chat_id,
        text=msg,
        parse_mode="Markdown"
    )
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo enviar el mensaje a Telegram: {res.get('error') or res.get('reason')}"
        )

    return {"success": True, "message": "Mensaje de prueba enviado exitosamente a tu Telegram."}
