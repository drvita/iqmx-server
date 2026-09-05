import logging
import re
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.customer import Customer
from app.models.user import User
from app.models.customer_subscription import CustomerSubscription
from app.api.admin_auth import get_current_admin

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/customers", tags=["admin-customers"])

EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"


class AdminCustomerResponse(BaseModel):
    id: int
    user_id: int
    company_name: str
    contact_name: str
    email: str
    phone: Optional[str] = None
    tax_id: Optional[str] = None
    origin: str
    is_active: bool
    privacy_accepted_at: datetime
    created_at: datetime
    whatsapp_numbers_count: int = 0
    active_plans: List[str] = []


class AdminCustomerStatusUpdate(BaseModel):
    is_active: bool


class AdminUpdateCustomerRequest(BaseModel):
    company_name: Optional[str] = Field(None, min_length=2, max_length=150)
    contact_name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[str] = Field(None, min_length=5, max_length=150)
    phone: Optional[str] = Field(None, max_length=50)
    tax_id: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        clean = v.strip().lower()
        if not re.match(EMAIL_REGEX, clean):
            raise ValueError("El correo electrónico no tiene un formato válido.")
        return clean


@router.get("", response_model=List[AdminCustomerResponse])
def list_customers(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Lista todos los clientes corporativos registrados en el portal central,
    incluyendo su correo, estado, números de WhatsApp asociados y membresías activas.
    """
    customers = db.query(Customer).order_by(Customer.id.desc()).all()
    now = datetime.utcnow()

    results = []
    for c in customers:
        user_email = c.user.email if c.user else "sin_correo"
        wa_count = len(c.whatsapp_numbers) if c.whatsapp_numbers else 0

        # Membresías activas o trial vigentes
        active_plans = []
        if c.subscriptions:
            for s in c.subscriptions:
                if s.status in ["active", "trial"] and s.current_period_end > now:
                    plan_name = s.plan.name if s.plan else f"Plan #{s.plan_id}"
                    active_plans.append(plan_name)

        results.append(AdminCustomerResponse(
            id=c.id,
            user_id=c.user_id,
            company_name=c.company_name,
            contact_name=c.contact_name,
            email=user_email,
            phone=c.phone,
            tax_id=c.tax_id,
            origin=c.origin or "web_signup",
            is_active=c.is_active,
            privacy_accepted_at=c.privacy_accepted_at,
            created_at=c.created_at,
            whatsapp_numbers_count=wa_count,
            active_plans=active_plans
        ))

    return results


@router.get("/{customer_id}", response_model=AdminCustomerResponse)
def get_customer_detail(
    customer_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Obtiene el detalle de un cliente específico."""
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cliente #{customer_id} no encontrado."
        )

    now = datetime.utcnow()
    user_email = c.user.email if c.user else "sin_correo"
    wa_count = len(c.whatsapp_numbers) if c.whatsapp_numbers else 0

    active_plans = []
    if c.subscriptions:
        for s in c.subscriptions:
            if s.status in ["active", "trial"] and s.current_period_end > now:
                plan_name = s.plan.name if s.plan else f"Plan #{s.plan_id}"
                active_plans.append(plan_name)

    return AdminCustomerResponse(
        id=c.id,
        user_id=c.user_id,
        company_name=c.company_name,
        contact_name=c.contact_name,
        email=user_email,
        phone=c.phone,
        tax_id=c.tax_id,
        origin=c.origin or "web_signup",
        is_active=c.is_active,
        privacy_accepted_at=c.privacy_accepted_at,
        created_at=c.created_at,
        whatsapp_numbers_count=wa_count,
        active_plans=active_plans
    )


@router.patch("/{customer_id}/status", response_model=AdminCustomerResponse)
def update_customer_status(
    customer_id: int,
    payload: AdminCustomerStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Permite al administrador suspender o reactivar una cuenta de cliente."""
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cliente #{customer_id} no encontrado."
        )

    c.is_active = payload.is_active
    db.commit()
    db.refresh(c)
    logger.info(f"Admin #{admin.id} actualizó estado de Cliente #{c.id} a is_active={c.is_active}")

    return get_customer_detail(customer_id=c.id, db=db, admin=admin)


@router.put("/{customer_id}", response_model=AdminCustomerResponse)
@router.patch("/{customer_id}", response_model=AdminCustomerResponse)
def update_customer(
    customer_id: int,
    payload: AdminUpdateCustomerRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Permite al administrador editar los datos principales de un cliente corporativo:
    - Nombre de la empresa
    - Nombre del contacto (sincronizado con su usuario)
    - Correo electrónico (validando unicidad contra otros usuarios)
    - Teléfono
    - RFC / Tax ID
    - Estado de activación (activo o suspendido)
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cliente #{customer_id} no encontrado."
        )

    user = customer.user
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario del cliente #{customer_id} no encontrado en la base de datos."
        )

    # 1. Validación y actualización de Email
    if payload.email is not None:
        clean_email = payload.email.strip().lower()
        if clean_email != user.email:
            existing = db.query(User).filter(User.email == clean_email).first()
            if existing and existing.id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"El correo electrónico '{clean_email}' ya se encuentra registrado en otra cuenta."
                )
            user.email = clean_email

    # 2. Nombre del contacto (se actualiza en Customer y en User)
    if payload.contact_name is not None:
        clean_contact = payload.contact_name.strip()
        customer.contact_name = clean_contact
        user.name = clean_contact

    # 3. Nombre de la empresa
    if payload.company_name is not None:
        customer.company_name = payload.company_name.strip()

    # 4. Teléfono
    if payload.phone is not None:
        customer.phone = payload.phone.strip() if payload.phone.strip() else None

    # 5. Tax ID / RFC
    if payload.tax_id is not None:
        customer.tax_id = payload.tax_id.strip() if payload.tax_id.strip() else None

    # 6. Estado de la cuenta (activo o suspendido)
    if payload.is_active is not None:
        customer.is_active = payload.is_active

    customer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(customer)
    db.refresh(user)

    logger.info(
        f"Admin #{admin.id} actualizó información del Cliente #{customer.id} "
        f"('{customer.company_name}'): email={user.email}, is_active={customer.is_active}"
    )

    return get_customer_detail(customer_id=customer.id, db=db, admin=admin)
