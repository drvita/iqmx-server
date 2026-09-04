import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from typing import Optional
import re

from app.db.database import get_db
from app.models.user import User
from app.models.role import Role
from app.models.customer import Customer
from app.models.customer_webhook import CustomerWebhook
from app.models.customer_subscription import CustomerSubscription
from app.models.membership_plan import MembershipPlan
from app.services.subscription_service import calculate_period_end_for_new
from app.lib.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_customer
)
from app.lib.crypto import generate_secure_secret

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/portal/auth", tags=["portal-auth"])

EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"

# --- Schemas ---

class CustomerRegisterRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=150)
    contact_name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=150)
    phone: Optional[str] = Field(None, max_length=50)
    password: str = Field(..., min_length=8, max_length=100)
    tax_id: Optional[str] = Field(None, max_length=50)
    privacy_accepted: bool = Field(..., description="Debe aceptar expresamente el Aviso de Privacidad y Términos")

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("La contraseña debe incluir al menos una letra mayúscula.")
        if not re.search(r"[a-z]", v):
            raise ValueError("La contraseña debe incluir al menos una letra minúscula.")
        if not re.search(r"[0-9]", v):
            raise ValueError("La contraseña debe incluir al menos un número.")
        return v

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(EMAIL_REGEX, clean):
            raise ValueError("El correo electrónico no tiene un formato válido.")
        return clean

class CustomerLoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=150)
    password: str

class CustomerProfileResponse(BaseModel):
    id: int
    company_name: str
    contact_name: str
    email: str
    phone: Optional[str]
    tax_id: Optional[str]
    origin: str
    privacy_accepted_at: datetime
    is_active: bool

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    customer: CustomerProfileResponse

# --- Endpoints ---

@router.post("/register", response_model=AuthResponse)
async def register_customer(
    req: CustomerRegisterRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Registra un nuevo cliente corporativo en el portal:
    1. Valida el consentimiento legal obligatorio.
    2. Crea la cuenta en la tabla users y le asigna el rol 'customer'.
    3. Crea el perfil en la tabla customers guardando timestamp e IP de auditoría.
    4. Inicializa su registro de webhook con una clave secreta HMAC generada.
    5. Retorna el token JWT de sesión.
    """
    if not req.privacy_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Es obligatorio aceptar el Aviso de Privacidad y Términos de Servicio para registrarse."
        )

    clean_email = req.email.strip().lower()

    # Verificar si el correo ya existe
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico ingresado ya se encuentra registrado."
        )

    # Obtener o crear rol 'customer'
    customer_role = db.query(Role).filter(Role.name == "customer").first()
    if not customer_role:
        customer_role = Role(name="customer")
        db.add(customer_role)
        db.commit()
        db.refresh(customer_role)

    # Capturar IP para cumplimiento de auditoría legal
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)
    if client_ip and "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    # 1. Crear usuario
    new_user = User(
        name=req.contact_name.strip(),
        email=clean_email,
        password_hash=hash_password(req.password),
        role_id=customer_role.id
    )
    new_user.roles.append(customer_role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 2. Crear registro de Customer
    new_customer = Customer(
        user_id=new_user.id,
        company_name=req.company_name.strip(),
        contact_name=req.contact_name.strip(),
        phone=req.phone.strip() if req.phone else None,
        tax_id=req.tax_id.strip() if req.tax_id else None,
        origin="web_signup",
        privacy_accepted_at=datetime.utcnow(),
        privacy_ip=client_ip,
        is_active=True
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)

    # 3. Inicializar configuración de webhook con secreto pre-generado
    new_webhook = CustomerWebhook(
        customer_id=new_customer.id,
        url=None,
        secret_token=generate_secure_secret(32),
        is_active=True
    )
    db.add(new_webhook)
    db.commit()

    # 4. Generar token de acceso JWT
    token = create_access_token(data={"sub": str(new_user.id), "user_id": new_user.id, "email": new_user.email})

    logger.info(f"Nuevo cliente registrado: {new_customer.company_name} (User ID #{new_user.id})")

    return AuthResponse(
        access_token=token,
        user_id=new_user.id,
        customer=CustomerProfileResponse(
            id=new_customer.id,
            company_name=new_customer.company_name,
            contact_name=new_customer.contact_name,
            email=new_user.email,
            phone=new_customer.phone,
            tax_id=new_customer.tax_id,
            origin=new_customer.origin,
            privacy_accepted_at=new_customer.privacy_accepted_at,
            is_active=new_customer.is_active
        )
    )

@router.post("/login", response_model=AuthResponse)
async def login_customer(
    req: CustomerLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Inicio de sesión para clientes del portal:
    Verifica credenciales, valida pertenencia al rol 'customer' y retorna el token JWT.
    """
    clean_email = req.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo electrónico o contraseña incorrectos."
        )

    # Validar rol customer
    if not user.has_role("customer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta no cuenta con permisos de acceso al Portal de Clientes."
        )

    customer = db.query(Customer).filter(Customer.user_id == user.id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró el perfil de cliente asociado."
        )

    if not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Su cuenta de cliente se encuentra suspendida o inactiva."
        )

    token = create_access_token(data={"sub": str(user.id), "user_id": user.id, "email": user.email})

    return AuthResponse(
        access_token=token,
        user_id=user.id,
        customer=CustomerProfileResponse(
            id=customer.id,
            company_name=customer.company_name,
            contact_name=customer.contact_name,
            email=user.email,
            phone=customer.phone,
            tax_id=customer.tax_id,
            origin=customer.origin,
            privacy_accepted_at=customer.privacy_accepted_at,
            is_active=customer.is_active
        )
    )

@router.get("/me", response_model=CustomerProfileResponse)
async def get_my_profile(
    current_customer: Customer = Depends(get_current_customer)
):
    """
    Retorna el perfil del cliente actualmente autenticado.
    """
    return CustomerProfileResponse(
        id=current_customer.id,
        company_name=current_customer.company_name,
        contact_name=current_customer.contact_name,
        email=current_customer.user.email,
        phone=current_customer.phone,
        tax_id=current_customer.tax_id,
        origin=current_customer.origin,
        privacy_accepted_at=current_customer.privacy_accepted_at,
        is_active=current_customer.is_active
    )
