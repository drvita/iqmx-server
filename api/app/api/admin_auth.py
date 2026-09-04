import logging
import re
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
        role=current_admin.role_name or "admin"
    )
