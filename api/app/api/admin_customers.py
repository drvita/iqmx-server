import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.customer import Customer
from app.models.user import User
from app.models.customer_subscription import CustomerSubscription
from app.api.admin_auth import get_current_admin

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/customers", tags=["admin-customers"])


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
