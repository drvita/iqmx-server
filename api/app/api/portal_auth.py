import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
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
from app.config import settings
from app.services.notifications.manager import NotificationManager
from app.lib.redis_client import (
    save_email_verification_token,
    consume_email_verification_token,
    get_user_id_from_verification_token
)

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
    email_verified: bool = False
    email_verified_at: Optional[datetime] = None

class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=120)

class VerifyEmailResponse(BaseModel):
    success: bool
    message: str
    email: str

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
    background_tasks: BackgroundTasks,
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

    # 5. Generar token de verificación de correo en Redis y enviar email de bienvenida
    verification_token = generate_secure_secret(32)
    save_email_verification_token(new_user.id, verification_token, ttl_seconds=86400)

    verification_url = f"{settings.PORTAL_BASE_URL}/portal/verify-email?token={verification_token}"
    background_tasks.add_task(
        NotificationManager.notify_customer_template,
        to_email=new_user.email,
        template_uuid=settings.MAILTRAP_TEMPLATE_WELCOME,
        template_variables={
            "user_name": new_customer.contact_name,
            "company": new_customer.company_name,
            "verification_url": verification_url,
            "support_email": settings.MAIL_FROM_EMAIL,
        },
        from_name="IQISSMexico",
        from_email=settings.MAIL_FROM_EMAIL,
        to_name=new_customer.contact_name,
    )

    logger.info(f"Nuevo cliente registrado: {new_customer.company_name} (User ID #{new_user.id}). Token de verificación generado.")

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
            is_active=new_customer.is_active,
            email_verified=new_user.is_email_verified,
            email_verified_at=new_user.email_verified_at
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
            is_active=customer.is_active,
            email_verified=user.is_email_verified,
            email_verified_at=user.email_verified_at
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
        is_active=current_customer.is_active,
        email_verified=current_customer.user.is_email_verified,
        email_verified_at=current_customer.user.email_verified_at
    )


@router.get("/verify-email/preview")
def preview_email_verification(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Consulta pasiva del estado del token para mostrar en la pantalla interactiva
    sin consumirlo ni mutar la base de datos (inofensivo para crawlers/escáneres de Outlook/Gmail).
    """
    user_id = get_user_id_from_verification_token(token)
    if not user_id:
        return {"valid": False, "email": None}

    user = db.get(User, user_id)
    if not user:
        return {"valid": False, "email": None}

    # Ofuscar correo para privacidad (ej. j***n@empresa.com)
    parts = user.email.split("@")
    if len(parts) == 2 and len(parts[0]) > 2:
        masked_email = f"{parts[0][0]}***{parts[0][-1]}@{parts[1]}"
    else:
        masked_email = user.email

    return {
        "valid": True,
        "email": user.email,
        "masked_email": masked_email,
        "user_name": user.name
    }


@router.post("/verify-email", response_model=VerifyEmailResponse)
def verify_customer_email(
    req: VerifyEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Valida y consume el token efímero de verificación en Redis.
    Actualiza email_verified_at en PostgreSQL y quema el token para un solo uso.
    Notifica a los administradores vía Telegram con los datos del nuevo lead verificado.
    """
    user_id = consume_email_verification_token(req.token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El enlace de verificación es inválido o ha expirado. Por favor solicita uno nuevo."
        )

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado."
        )

    user.email_verified_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    logger.info(f"Correo verificado exitosamente para el usuario #{user.id} ({user.email}).")

    # Obtener información del cliente para notificar a los administradores
    customer = db.query(Customer).filter(Customer.user_id == user.id).first()
    customer_id = customer.id if customer else None
    contact_name = customer.contact_name if customer and customer.contact_name else user.name
    phone = customer.phone if customer and customer.phone else "No registrado"
    company_name = customer.company_name if customer and customer.company_name else "Particular / Sin empresa"

    telegram_msg = (
        "🔔 *¡Nuevo Usuario Validado en IQISSMexico!* 🚀\n\n"
        "Un usuario ha verificado exitosamente su correo electrónico y muestra interés activo en la plataforma:\n\n"
        f"• *ID Usuario:* `#{user.id}`" + (f" (Cliente `#{customer_id}`)\n" if customer_id else "\n") +
        f"• *Nombre:* {contact_name}\n"
        f"• *Correo:* `{user.email}`\n"
        f"• *Teléfono:* {phone}\n"
        f"• *Empresa:* {company_name}\n\n"
        f"🕒 *Fecha de Verificación:* {datetime.utcnow().strftime('%d/%m/%Y %H:%M UTC')}"
    )

    background_tasks.add_task(
        NotificationManager.notify_admins,
        message=telegram_msg,
        parse_mode="Markdown"
    )

    return VerifyEmailResponse(
        success=True,
        message="Tu correo electrónico ha sido verificado exitosamente.",
        email=user.email
    )


@router.post("/resend-verification")
def resend_email_verification(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reenvía el correo de verificación con un nuevo token efímero con vigencia de 24 horas.
    """
    if current_user.is_email_verified:
        return {
            "success": True,
            "message": "Tu correo ya se encuentra verificado."
        }

    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    company_name = customer.company_name if customer else "Su Empresa"
    contact_name = customer.contact_name if customer else current_user.name

    new_token = generate_secure_secret(32)
    save_email_verification_token(current_user.id, new_token, ttl_seconds=86400)

    verification_url = f"{settings.PORTAL_BASE_URL}/portal/verify-email?token={new_token}"
    background_tasks.add_task(
        NotificationManager.notify_customer_template,
        to_email=current_user.email,
        template_uuid=settings.MAILTRAP_TEMPLATE_WELCOME,
        template_variables={
            "user_name": contact_name,
            "company": company_name,
            "verification_url": verification_url,
            "support_email": settings.MAIL_FROM_EMAIL,
        },
        from_name="IQISSMexico",
        from_email=settings.MAIL_FROM_EMAIL,
        to_name=contact_name,
    )

    logger.info(f"Reenvío de verificación despachado para User #{current_user.id} ({current_user.email}).")

    return {
        "success": True,
        "message": f"Se ha enviado un nuevo enlace de confirmación a {current_user.email}."
    }
