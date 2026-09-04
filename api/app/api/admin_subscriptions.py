import logging
from datetime import datetime, timedelta
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
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

# --- Endpoints ---

@router.get("", response_model=List[SubscriptionResponse])
def list_subscriptions(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Lista todas las suscripciones registradas."""
    subs = db.query(CustomerSubscription).order_by(CustomerSubscription.id.desc()).all()
    res = []
    for s in subs:
        cust = s.customer
        plan = s.plan
        res.append(SubscriptionResponse(
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
        ))
    return res

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
