import logging
from datetime import datetime, timedelta
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.database import get_db
from app.models.customer import Customer
from app.models.membership_plan import MembershipPlan
from app.models.customer_subscription import CustomerSubscription
from app.api.admin_auth import get_current_admin
from app.models.user import User
from app.config import settings

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/subscriptions", tags=["admin-subscriptions"])

# --- Schemas ---

class SubscriptionResponse(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    customer_email: str
    plan_id: int
    plan_name: str
    product_slug: str
    price_mxn: float
    status: str
    current_period_start: str
    current_period_end: str
    mp_preapproval_id: Optional[str] = None
    external_tenant_id: Optional[str] = None

class CreateSubscriptionLinkRequest(BaseModel):
    customer_id: int
    plan_id: int
    payer_email: Optional[str] = None

class CreateSubscriptionLinkResponse(BaseModel):
    subscription_id: int
    checkout_url: str
    preapproval_id: Optional[str] = None

class UpdateSubscriptionRequest(BaseModel):
    status: Optional[str] = Field(None, pattern="^(trial|active|past_due|cancelled|paused)$")
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None

def serialize_subscription(s: CustomerSubscription) -> SubscriptionResponse:
    cust = s.customer
    plan = s.plan
    return SubscriptionResponse(
        id=s.id,
        customer_id=s.customer_id,
        customer_name=cust.company_name if cust else "Desconocido",
        customer_email=cust.user.email if (cust and cust.user) else "",
        plan_id=s.plan_id,
        plan_name=plan.name if plan else "Plan eliminado",
        product_slug=plan.product.slug if (plan and plan.product) else "unknown",
        price_mxn=float(plan.price_mxn) if plan else 0.0,
        status=s.status,
        current_period_start=s.current_period_start.isoformat(),
        current_period_end=s.current_period_end.isoformat(),
        mp_preapproval_id=s.mp_preapproval_id,
        external_tenant_id=s.external_tenant_id
    )

# --- Endpoints ---

@router.get("", response_model=List[SubscriptionResponse])
def list_subscriptions(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Lista todas las suscripciones registradas."""
    subs = db.query(CustomerSubscription).order_by(CustomerSubscription.id.desc()).all()
    return [serialize_subscription(s) for s in subs]

@router.post("/generate-link", response_model=CreateSubscriptionLinkResponse)
async def generate_mercadopago_subscription(
    req: CreateSubscriptionLinkRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Crea una suscripción recurrente en Mercado Pago y genera el enlace de checkout
    para que el cliente autorice el cobro mensual recurrente.
    """
    customer = db.query(Customer).filter(Customer.id == req.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")

    plan = db.query(MembershipPlan).filter(MembershipPlan.id == req.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado.")

    payer_email = req.payer_email or (customer.user.email if customer.user else "cliente@iqissmexico.com")

    # Crear registro local de suscripción
    now = datetime.utcnow()
    sub = CustomerSubscription(
        customer_id=customer.id,
        plan_id=plan.id,
        status="trial" if float(plan.price_mxn) == 0 else "pending_payment",
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    # Si es plan gratuito, no se crea checkout en Mercado Pago
    if float(plan.price_mxn) == 0:
        return CreateSubscriptionLinkResponse(
            subscription_id=sub.id,
            checkout_url="https://iqissmexico.com/portal/dashboard?plan=free_activated",
            preapproval_id=None
        )

    # Llamar a Mercado Pago API REST de Suscripciones (/preapproval)
    mp_token = settings.MERCADOPAGO_ACCESS_TOKEN
    if not mp_token:
        # Modo simulación / sandbox sin credenciales configuradas
        mock_checkout = f"https://www.mercadopago.com.mx/subscriptions/checkout?pref_id=mock_sub_{sub.id}"
        sub.mp_preapproval_id = f"mock_preapproval_{sub.id}"
        db.commit()
        return CreateSubscriptionLinkResponse(
            subscription_id=sub.id,
            checkout_url=mock_checkout,
            preapproval_id=sub.mp_preapproval_id
        )

    # En entorno que no sea producción, si se define MERCADOPAGO_TEST_PAYER_EMAIL se utiliza como pagador de pruebas en Mercado Pago
    is_production = (settings.ENVIRONMENT or "").strip().lower() == "production"
    payer_email_to_send = payer_email
    if not is_production and settings.mercadopago_resolved_test_payer_email:
        payer_email_to_send = settings.mercadopago_resolved_test_payer_email

    url = "https://api.mercadopago.com/preapproval"
    payload = {
        "reason": f"{plan.name} - IQISSMexico",
        "auto_recurring": {
            "frequency": 1,
            "frequency_type": "months",
            "transaction_amount": float(plan.price_mxn),
            "currency_id": "MXN"
        },
        "payer_email": payer_email_to_send,
        "back_url": "https://iqissmexico.com/portal/dashboard?status=subscription_authorized",
        "external_reference": f"sub_{sub.id}_cust_{customer.id}"
    }
    headers = {
        "Authorization": f"Bearer {mp_token}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(url, json=payload, headers=headers)
        if res.status_code not in [200, 201]:
            logger.error(f"Fallo creando suscripción en Mercado Pago: {res.status_code} {res.text}")
            error_msg = f"Error en Mercado Pago API: {res.text}"
            if "Both payer and collector must be real or test users" in res.text:
                error_msg = (
                    "Mercado Pago Sandbox exige que el correo del comprador sea un Usuario de Prueba (@testuser.com). "
                    "Crea una cuenta de comprador de prueba en tu panel de Mercado Pago y configúrala en MERCADOPAGO_TEST_PAYER_EMAIL en api/.env"
                )
            raise HTTPException(
                status_code=502,
                detail=error_msg
            )
        data = res.json()
        preapproval_id = data.get("id")
        init_point = data.get("init_point")

        sub.mp_preapproval_id = preapproval_id
        db.commit()

        return CreateSubscriptionLinkResponse(
            subscription_id=sub.id,
            checkout_url=init_point,
            preapproval_id=preapproval_id
        )

@router.patch("/{subscription_id}", response_model=SubscriptionResponse)
def update_subscription(
    subscription_id: int,
    req: UpdateSubscriptionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Permite al administrador editar el estado y periodo de una suscripción.
    Si la suscripción está vinculada a un inquilino del CRM (external_tenant_id),
    sincroniza el estado hacia crm.organization.
    """
    sub = db.query(CustomerSubscription).filter(CustomerSubscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suscripción no encontrada."
        )

    status_changed = False
    if req.status is not None:
        clean_status = req.status.strip().lower()
        if clean_status != sub.status:
            sub.status = clean_status
            status_changed = True
            if clean_status == "cancelled":
                sub.cancelled_at = datetime.utcnow()
            elif sub.cancelled_at is not None:
                sub.cancelled_at = None

    if req.current_period_start is not None:
        sub.current_period_start = req.current_period_start

    if req.current_period_end is not None:
        if req.current_period_start is not None and req.current_period_end <= req.current_period_start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La fecha de fin de periodo debe ser posterior a la fecha de inicio."
            )
        elif req.current_period_start is None and req.current_period_end <= sub.current_period_start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La fecha de fin de periodo debe ser posterior a la fecha de inicio actual."
            )
        sub.current_period_end = req.current_period_end

    sub.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(sub)

    # Si cambió el estado y tiene tenant CRM asignado, sincronizar crm.organization
    if status_changed and sub.external_tenant_id:
        try:
            # Mapeo de estados hacia crm.organization ('active', 'trial', 'suspended', 'cancelled')
            crm_status = "active"
            if sub.status in ["cancelled", "past_due"]:
                crm_status = "suspended" if sub.status == "past_due" else "cancelled"
            elif sub.status == "paused":
                crm_status = "suspended"
            elif sub.status == "trial":
                crm_status = "trial"

            update_query = text("UPDATE crm.organization SET status = :status WHERE id = :id")
            db.execute(update_query, {"status": crm_status, "id": sub.external_tenant_id})
            db.commit()
            logger.info(f"Sincronizado estado CRM '{crm_status}' para organización {sub.external_tenant_id}")
        except Exception as e:
            logger.warning(f"No se pudo sincronizar estado CRM para org {sub.external_tenant_id}: {e}")

    logger.info(f"Admin #{admin.id} actualizó suscripción #{sub.id} (status={sub.status})")
    return serialize_subscription(sub)
