import logging
import re
import secrets
from datetime import datetime
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.lib.crypto import generate_secure_secret
from app.lib.security import hash_password
from app.models.customer import Customer
from app.models.customer_webhook import CustomerWebhook
from app.models.role import Role
from app.models.user import User

logger = logging.getLogger("uvicorn.error")

PLACEHOLDER_EMAIL_DOMAIN = "@clientes.iqissmexico.local"


def is_placeholder_email(email: Optional[str]) -> bool:
    """Retorna True si el correo corresponde a un placeholder técnico interno."""
    if not email:
        return False
    return email.strip().lower().endswith(PLACEHOLDER_EMAIL_DOMAIN)


def build_placeholder_email() -> str:
    """Genera un correo técnico único para clientes físicos sin correo real."""
    return f"sin-correo-{secrets.token_hex(6)}{PLACEHOLDER_EMAIL_DOMAIN}"


def normalize_phone(phone: Optional[str]) -> Optional[str]:
    """
    Normaliza un número telefónico para comparación confiable sin duplicados:
    - Conserva solo dígitos.
    - Si tiene menos de 7 dígitos, retorna None.
    - Para números mexicanos de 13 dígitos con prefijo '521' o 12 dígitos con '52',
      conserva los últimos 10 dígitos nacionales.
    - Trunca a 30 caracteres como límite de columna.
    """
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if len(digits) < 7:
        return None
    if len(digits) == 13 and digits.startswith("521"):
        return digits[-10:]
    if len(digits) == 12 and digits.startswith("52"):
        return digits[-10:]
    if len(digits) > 30:
        return digits[:30]
    return digits


def _get_or_create_customer_role(db: Session) -> Role:
    customer_role = db.query(Role).filter(Role.name == "customer").first()
    if not customer_role:
        customer_role = Role(name="customer")
        db.add(customer_role)
        db.flush()
    return customer_role


def create_manual_customer(
    db: Session,
    *,
    company_name: str,
    contact_name: str,
    email: Optional[str],
    phone: Optional[str],
    tax_id: Optional[str],
    forum_enabled: bool,
    admin_id: int,
) -> Customer:
    """
    Crea un cliente físico manualmente desde el panel administrativo:
    - No define contraseña (User.password_hash = None) para impedir login hasta
      que el cliente complete su registro en /portal/register.
    - Requiere al menos un correo electrónico válido o un teléfono válido.
    - Si no se proporciona correo, asigna un correo técnico interno (.local).
    """
    clean_email = email.strip().lower() if email and email.strip() else None
    clean_phone = phone.strip() if phone and phone.strip() else None
    norm_phone = normalize_phone(clean_phone)

    if not clean_email and not norm_phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debes proporcionar al menos un correo electrónico o un número de teléfono válido.",
        )

    if clean_email:
        if is_placeholder_email(clean_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El dominio de correo técnico está reservado para uso interno.",
            )
        existing_user = db.query(User).filter(User.email == clean_email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El correo electrónico '{clean_email}' ya se encuentra registrado en otra cuenta.",
            )

    if norm_phone:
        existing_phone_cust = (
            db.query(Customer).filter(Customer.phone_normalized == norm_phone).first()
        )
        if existing_phone_cust:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Ya existe un cliente registrado con ese número de teléfono "
                    f"({existing_phone_cust.company_name})."
                ),
            )

    customer_role = _get_or_create_customer_role(db)
    final_email = clean_email or build_placeholder_email()

    new_user = User(
        name=contact_name.strip(),
        email=final_email,
        password_hash=None,
        role_id=customer_role.id,
    )
    new_user.roles.append(customer_role)
    db.add(new_user)
    db.flush()

    now = datetime.utcnow()
    new_customer = Customer(
        user_id=new_user.id,
        company_name=company_name.strip(),
        contact_name=contact_name.strip(),
        phone=clean_phone,
        phone_normalized=norm_phone,
        tax_id=tax_id.strip().upper() if tax_id and tax_id.strip() else None,
        origin="direct_sales",
        privacy_accepted_at=now,
        privacy_ip=None,
        is_active=True,
        forum_enabled=bool(forum_enabled),
        created_at=now,
        updated_at=now,
    )
    db.add(new_customer)
    db.flush()

    webhook = CustomerWebhook(
        customer_id=new_customer.id,
        url=None,
        secret_token=generate_secure_secret(32),
        is_active=True,
    )
    db.add(webhook)
    db.commit()
    db.refresh(new_customer)

    logger.info(
        f"Admin #{admin_id} registró cliente físico manual #{new_customer.id} "
        f"('{new_customer.company_name}', forum_enabled={new_customer.forum_enabled})."
    )
    return new_customer


def find_claimable_customer_for_registration(
    db: Session,
    *,
    clean_email: str,
    raw_phone: Optional[str],
) -> Optional[Tuple[User, Customer]]:
    """
    Busca si existe una cuenta pre-registrada sin contraseña elegible para ser
    reclamada durante el registro en /api/portal/auth/register.

    Reglas de seguridad anti-secuestro de cuenta (Account Takeover):
    1. Si existe User por email:
       - Si ya tiene password_hash o es bot/admin -> error 400 (correo ya registrado).
       - Si no tiene Customer asociado -> error 400.
       - Si Customer está suspendido (is_active=False) -> error 403.
    2. Si existe coincidencia por phone_normalized:
       - Si también hubo coincidencia por email y pertenecen a usuarios distintos -> 409 Conflict.
       - Si hay más de un Customer con ese teléfono normalizado -> 409 Conflict (ambigüedad).
       - Si ya tiene password_hash -> si el email no coincidió, se trata como cuenta separada
         o conflicto; si no tiene password_hash, solo se puede reclamar por teléfono cuando
         el correo en BD es placeholder (@clientes.iqissmexico.local). Si el admin registró
         un correo real distinto, se rechaza con 409 Conflict para evitar secuestro vía teléfono.
    """
    norm_phone = normalize_phone(raw_phone)

    user_by_email = db.query(User).filter(User.email == clean_email).first()
    if user_by_email:
        if user_by_email.has_role("bot") or user_by_email.has_role("admin"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo electrónico ingresado ya se encuentra registrado.",
            )
        if user_by_email.password_hash is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo electrónico ingresado ya se encuentra registrado.",
            )
        cust_by_email = (
            db.query(Customer).filter(Customer.user_id == user_by_email.id).first()
        )
        if not cust_by_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo electrónico ingresado ya se encuentra registrado.",
            )
        if not cust_by_email.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu cuenta se encuentra suspendida. Contacta a soporte para reactivarla.",
            )

        if norm_phone:
            phone_matches = (
                db.query(Customer).filter(Customer.phone_normalized == norm_phone).all()
            )
            for pm in phone_matches:
                if pm.user_id != user_by_email.id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            "El correo y el teléfono ingresados corresponden a cuentas distintas. "
                            "Contacta a soporte para unificar tus datos."
                        ),
                    )
        return user_by_email, cust_by_email

    if not norm_phone:
        return None

    phone_matches = (
        db.query(Customer).filter(Customer.phone_normalized == norm_phone).all()
    )
    if not phone_matches:
        return None

    claimable_matches = [
        c for c in phone_matches if c.user and c.user.password_hash is None
    ]
    if not claimable_matches:
        return None

    if len(claimable_matches) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Existen múltiples registros previos con este número telefónico. "
                "Contacta a soporte para completar tu activación."
            ),
        )

    cust = claimable_matches[0]
    user = cust.user

    if user.has_role("bot") or user.has_role("admin"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No es posible vincular este número telefónico. Contacta a soporte.",
        )

    if not is_placeholder_email(user.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Este teléfono ya está asociado a una cuenta pre-registrada con otro correo electrónico. "
                "Regístrate usando ese mismo correo o solicita al administrador actualizarlo."
            ),
        )

    if not cust.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta se encuentra suspendida. Contacta a soporte para reactivarla.",
        )

    return user, cust


def activate_claimed_customer(
    db: Session,
    *,
    user: User,
    customer: Customer,
    clean_email: str,
    contact_name: str,
    company_name: str,
    raw_phone: Optional[str],
    tax_id: Optional[str],
    password: str,
    client_ip: Optional[str],
) -> Tuple[User, Customer]:
    """
    Activa una cuenta pre-registrada sin contraseña durante /api/portal/auth/register,
    preservando su ID, historial en el Foro, estado de forum_enabled y origen.
    """
    customer_role = _get_or_create_customer_role(db)
    if not user.has_role("customer"):
        user.roles.append(customer_role)
    if not user.role_id:
        user.role_id = customer_role.id

    if is_placeholder_email(user.email):
        user.email = clean_email

    clean_contact = contact_name.strip()
    if not user.name or not user.name.strip():
        user.name = clean_contact
    if not customer.contact_name or not customer.contact_name.strip():
        customer.contact_name = clean_contact
    if not customer.company_name or not customer.company_name.strip():
        customer.company_name = company_name.strip()

    user.password_hash = hash_password(password)

    if not customer.phone and raw_phone and raw_phone.strip():
        customer.phone = raw_phone.strip()
        customer.phone_normalized = normalize_phone(raw_phone)
    elif customer.phone and not customer.phone_normalized:
        customer.phone_normalized = normalize_phone(customer.phone)

    if not customer.tax_id and tax_id and tax_id.strip():
        customer.tax_id = tax_id.strip().upper()

    now = datetime.utcnow()
    customer.privacy_accepted_at = now
    customer.privacy_ip = client_ip
    customer.updated_at = now

    if not customer.webhook:
        db.add(
            CustomerWebhook(
                customer_id=customer.id,
                url=None,
                secret_token=generate_secure_secret(32),
                is_active=True,
            )
        )

    db.commit()
    db.refresh(user)
    db.refresh(customer)

    logger.info(
        f"Cuenta pre-registrada vinculada en /register: Customer #{customer.id} "
        f"('{customer.company_name}', User #{user.id}, email={user.email})."
    )
    return user, customer
