import logging
import re
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.database import get_db
from app.models.user import User
from app.models.role import Role
from app.api.admin_auth import get_current_admin
from app.lib.security import hash_password

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])

EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"

# --- Schemas ---

class SystemUserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    partner_id: Optional[int] = None

class CreateSystemUserRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=8, max_length=100)
    role: str = Field("admin", description="Rol del usuario interno ('admin', 'partner', 'contact')")
    partner_id: Optional[int] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(EMAIL_REGEX, clean):
            raise ValueError("El correo electrónico no tiene un formato válido.")
        return clean

    @field_validator("role")
    @classmethod
    def validate_system_role(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean == "customer":
            raise ValueError("No se pueden crear clientes desde el módulo de usuarios del sistema.")
        if clean not in ["admin", "partner", "contact"]:
            raise ValueError("Rol no válido para usuario de sistema.")
        return clean

class UpdateSystemUserRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    password: Optional[str] = Field(None, min_length=8, max_length=100)
    role: Optional[str] = None
    partner_id: Optional[int] = None

# --- Endpoints ---

@router.get("", response_model=List[SystemUserResponse])
def list_system_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Lista únicamente usuarios del sistema (excluyendo a clientes / rol customer).
    """
    customer_role = db.query(Role).filter(Role.name == "customer").first()
    query = db.query(User)
    if customer_role:
        query = query.filter(
            (User.role_id != customer_role.id) | (User.role_id.is_(None)),
            ~User.roles.any(Role.name == "customer")
        )
    users = query.order_by(User.id.asc()).all()

    return [
        SystemUserResponse(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role_name or "sin_rol",
            partner_id=u.partner_id
        )
        for u in users
    ]

@router.post("", response_model=SystemUserResponse, status_code=status.HTTP_201_CREATED)
def create_system_user(
    req: CreateSystemUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Crea un nuevo usuario de sistema (admin, partner, contact)."""
    clean_email = req.email.strip().lower()
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con este correo electrónico."
        )

    target_role = db.query(Role).filter(Role.name == req.role).first()
    if not target_role:
        target_role = Role(name=req.role)
        db.add(target_role)
        db.commit()
        db.refresh(target_role)

    new_user = User(
        name=req.name.strip(),
        email=clean_email,
        password_hash=hash_password(req.password),
        role_id=target_role.id,
        partner_id=req.partner_id
    )
    new_user.roles.append(target_role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"Usuario de sistema creado: {new_user.email} con rol {req.role} por admin #{admin.id}")

    return SystemUserResponse(
        id=new_user.id,
        name=new_user.name,
        email=new_user.email,
        role=new_user.role_name,
        partner_id=new_user.partner_id
    )

@router.patch("/{user_id}", response_model=SystemUserResponse)
def update_system_user(
    user_id: int,
    req: UpdateSystemUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Actualiza datos, contraseña o rol de un usuario de sistema."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    if user.has_role("customer"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pueden editar clientes desde este módulo.")

    if req.name:
        user.name = req.name.strip()
    if req.password:
        user.password_hash = hash_password(req.password)
    if req.partner_id is not None:
        user.partner_id = req.partner_id
    if req.role:
        target_role = db.query(Role).filter(Role.name == req.role.strip().lower()).first()
        if target_role:
            user.role_id = target_role.id
            user.roles = [target_role]

    db.commit()
    db.refresh(user)

    return SystemUserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role_name,
        partner_id=user.partner_id
    )
