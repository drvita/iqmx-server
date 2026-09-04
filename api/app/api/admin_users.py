import logging
import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.database import get_db
from app.models.user import User
from app.models.role import Role
from app.models.customer import Customer
from app.models.customer_webhook import CustomerWebhook
from app.api.admin_auth import get_current_admin
from app.lib.security import hash_password
from app.lib.crypto import generate_secure_secret

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])

EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"

# --- Schemas ---

class SystemUserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    roles: List[str] = []
    has_customer_role: bool = False
    customer_id: Optional[int] = None
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

class GrantCustomerRoleRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=150)
    contact_name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    tax_id: Optional[str] = Field(None, max_length=50)


def build_system_user_response(u: User, db: Session) -> SystemUserResponse:
    cust = db.query(Customer).filter(Customer.user_id == u.id).first()
    return SystemUserResponse(
        id=u.id,
        name=u.name,
        email=u.email,
        role=u.role_name or "sin_rol",
        roles=u.role_names,
        has_customer_role=u.has_role("customer"),
        customer_id=cust.id if cust else None,
        partner_id=u.partner_id
    )


# --- Endpoints ---

@router.get("", response_model=List[SystemUserResponse])
def list_system_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Lista usuarios del sistema (usuarios con roles admin, partner o contact).
    """
    system_roles = ["admin", "partner", "contact"]
    users = db.query(User).filter(
        User.roles.any(Role.name.in_(system_roles))
    ).order_by(User.id.asc()).all()

    # Fallback si algún usuario no tuviese relación cargada en user_has_role
    if not users:
        customer_role = db.query(Role).filter(Role.name == "customer").first()
        query = db.query(User)
        if customer_role:
            query = query.filter(User.role_id != customer_role.id)
        users = query.order_by(User.id.asc()).all()

    return [build_system_user_response(u, db) for u in users]

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

    return build_system_user_response(new_user, db)

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

    # Verificar que sea un usuario de sistema
    if not any(r in ["admin", "partner", "contact"] for r in user.role_names):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pueden editar usuarios externos desde este módulo.")

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
            had_customer = user.has_role("customer")
            new_roles = [target_role]
            if had_customer:
                cust_role = db.query(Role).filter(Role.name == "customer").first()
                if cust_role and cust_role.id != target_role.id:
                    new_roles.append(cust_role)
            user.roles = new_roles

    db.commit()
    db.refresh(user)

    return build_system_user_response(user, db)

@router.put("/{user_id}/customer-role", response_model=SystemUserResponse)
def grant_customer_role(
    user_id: int,
    req: GrantCustomerRoleRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Otorga el rol de cliente (customer) a un usuario del sistema, creando
    o reactivando su perfil de Customer y webhook asociado.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    customer_role = db.query(Role).filter(Role.name == "customer").first()
    if not customer_role:
        customer_role = Role(name="customer")
        db.add(customer_role)
        db.commit()
        db.refresh(customer_role)

    # 1. Asociar rol customer si no lo tiene
    if not user.has_role("customer"):
        user.roles.append(customer_role)

    # 2. Crear o reactivar perfil de Customer
    customer = db.query(Customer).filter(Customer.user_id == user.id).first()
    if customer:
        customer.company_name = req.company_name.strip()
        customer.contact_name = req.contact_name.strip()
        if req.phone is not None:
            customer.phone = req.phone.strip() if req.phone else None
        if req.tax_id is not None:
            customer.tax_id = req.tax_id.strip() if req.tax_id else None
        customer.is_active = True
    else:
        customer = Customer(
            user_id=user.id,
            company_name=req.company_name.strip(),
            contact_name=req.contact_name.strip(),
            phone=req.phone.strip() if req.phone else None,
            tax_id=req.tax_id.strip() if req.tax_id else None,
            origin="admin_granted",
            privacy_accepted_at=datetime.utcnow(),
            is_active=True
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

        # Inicializar webhook
        new_webhook = CustomerWebhook(
            customer_id=customer.id,
            url=None,
            secret_token=generate_secure_secret(32),
            is_active=True
        )
        db.add(new_webhook)

    db.commit()
    db.refresh(user)

    logger.info(f"Rol customer otorgado al usuario #{user.id} ({user.email}) por admin #{admin.id}")

    return build_system_user_response(user, db)

@router.delete("/{user_id}/customer-role", response_model=SystemUserResponse)
def revoke_customer_role(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Revoca el rol de cliente de un usuario del sistema y desactiva su perfil
    de Customer (preservando historial sin eliminar el registro).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    customer_role = db.query(Role).filter(Role.name == "customer").first()
    if customer_role and customer_role in user.roles:
        user.roles.remove(customer_role)

    # Si su role_id principal era customer, reasignar al primer rol disponible
    if customer_role and user.role_id == customer_role.id:
        remaining = [r for r in user.roles if r.id != customer_role.id]
        user.role_id = remaining[0].id if remaining else None

    # Desactivar perfil de Customer (sin eliminar para mantener integridad referencial)
    customer = db.query(Customer).filter(Customer.user_id == user.id).first()
    if customer:
        customer.is_active = False

    db.commit()
    db.refresh(user)

    logger.info(f"Rol customer revocado al usuario #{user.id} ({user.email}) por admin #{admin.id}")

    return build_system_user_response(user, db)
