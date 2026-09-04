from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.customer import Customer
from app.models.customer_subscription import CustomerSubscription
from app.models.membership_plan import MembershipPlan
from app.models.product import Product
from app.api.portal_auth import get_current_customer
from app.services.subscription_service import (
    check_subscription_conflict,
    activate_due_scheduled_subscriptions,
    calculate_period_end_for_new,
    has_customer_used_trial_before,
    get_customer_crm_info,
)

router = APIRouter(prefix="/api/portal/subscriptions", tags=["portal-subscriptions"])


class MySubscriptionItem(BaseModel):
    id: int
    plan_id: int
    plan_name: str
    product_slug: str
    product_name: str
    price_mxn: float
    billing_interval: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    days_remaining: int
    features_payload: Dict[str, Any]


class ConflictCheckResponse(BaseModel):
    has_active: bool
    conflict_type: str  # 'none', 'upgrade', 'downgrade', 'same_plan'
    current_plan_name: Optional[str] = None
    current_plan_price: Optional[float] = None
    current_period_end: Optional[datetime] = None
    new_plan_name: str
    new_plan_price: float
    message: Optional[str] = None


class ActiveProductSubscriptionResponse(BaseModel):
    has_active: bool
    product_slug: str
    product_name: str
    service_url: Optional[str] = None
    subscription: Optional[MySubscriptionItem] = None
    max_whatsapp_accounts: int = 0
    max_team_members: Optional[int] = None
    max_contacts: Optional[int] = None
    agenda_enabled: bool = False
    has_used_trial_before: bool = False
    crm_registered: bool = False
    crm_organization_id: Optional[str] = None
    crm_organization_name: Optional[str] = None
    crm_owner_email: Optional[str] = None
    temp_password: Optional[str] = None
    must_change_password: bool = False


@router.get("/active-product", response_model=ActiveProductSubscriptionResponse)
def get_active_product_subscription(
    product_slug: str = Query("crm", description="Slug del producto a verificar (ej. crm)"),
    db: Session = Depends(get_db),
    customer: Customer = Depends(get_current_customer)
):
    """
    Verifica si el cliente cuenta con una membresía activa o de prueba para un producto específico
    y devuelve sus límites operativos (cuota de números de WhatsApp, operadores, agenda, etc.),
    así como el estado de vinculación con la aplicación externa (service_url, crm_registered).
    """
    activate_due_scheduled_subscriptions(db)

    prod_slug = product_slug.strip().lower()
    prod = db.query(Product).filter(Product.slug == prod_slug).first()
    product_name = prod.name if prod else product_slug.upper()
    service_url = prod.service_url if prod else None

    has_used_trial = has_customer_used_trial_before(db, customer.id, prod_slug)
    cust_email = customer.user.email if customer.user else None
    crm_data = get_customer_crm_info(db, customer.id, cust_email) if prod_slug == "crm" else {
        "crm_registered": False,
        "crm_organization_id": None,
        "crm_organization_name": None,
        "crm_owner_email": None,
    }

    if prod_slug == "crm" and crm_data["crm_registered"] and crm_data.get("webhook_token"):
        from app.api.portal_crm import sync_customer_crm_webhook, get_crm_internal_url_and_secret
        m2m_url, _ = get_crm_internal_url_and_secret(db)
        sync_customer_crm_webhook(db, customer.id, crm_data["webhook_token"], m2m_url)

    now = datetime.utcnow()
    sub = db.query(CustomerSubscription).join(
        MembershipPlan, CustomerSubscription.plan_id == MembershipPlan.id
    ).join(
        Product, MembershipPlan.product_id == Product.id
    ).filter(
        CustomerSubscription.customer_id == customer.id,
        CustomerSubscription.status.in_(["active", "trial"]),
        CustomerSubscription.current_period_end > now,
        Product.slug == prod_slug
    ).order_by(CustomerSubscription.current_period_end.desc()).first()

    if not sub or not sub.plan:
        return ActiveProductSubscriptionResponse(
            has_active=False,
            product_slug=product_slug,
            product_name=product_name,
            service_url=service_url,
            subscription=None,
            max_whatsapp_accounts=0,
            max_team_members=0,
            max_contacts=0,
            agenda_enabled=False,
            has_used_trial_before=has_used_trial,
            crm_registered=crm_data["crm_registered"],
            crm_organization_id=crm_data["crm_organization_id"],
            crm_organization_name=crm_data["crm_organization_name"],
            crm_owner_email=crm_data["crm_owner_email"],
            temp_password=crm_data.get("temp_password"),
            must_change_password=crm_data.get("must_change_password", False),
        )

    features = sub.plan.features_payload or {}
    if sub.custom_features_override:
        features.update(sub.custom_features_override)

    remaining = max(0, (sub.current_period_end.date() - now.date()).days)

    item = MySubscriptionItem(
        id=sub.id,
        plan_id=sub.plan_id,
        plan_name=sub.plan.name,
        product_slug=product_slug,
        product_name=product_name,
        price_mxn=float(sub.plan.price_mxn),
        billing_interval=sub.plan.billing_interval,
        status=sub.status,
        current_period_start=sub.current_period_start,
        current_period_end=sub.current_period_end,
        days_remaining=remaining,
        features_payload=features
    )

    return ActiveProductSubscriptionResponse(
        has_active=True,
        product_slug=product_slug,
        product_name=product_name,
        service_url=service_url,
        subscription=item,
        max_whatsapp_accounts=features.get("max_whatsapp_accounts", 1),
        max_team_members=features.get("max_team_members"),
        max_contacts=features.get("max_contacts"),
        agenda_enabled=bool(features.get("agenda_enabled", False)),
        has_used_trial_before=has_used_trial,
        crm_registered=crm_data["crm_registered"],
        crm_organization_id=crm_data["crm_organization_id"],
        crm_organization_name=crm_data["crm_organization_name"],
        crm_owner_email=crm_data["crm_owner_email"],
        temp_password=crm_data.get("temp_password"),
        must_change_password=crm_data.get("must_change_password", False),
    )



@router.get("/my", response_model=List[MySubscriptionItem])
def get_my_subscriptions(
    db: Session = Depends(get_db),
    customer: Customer = Depends(get_current_customer)
):
    """
    Lista las membresías del cliente autenticado (activas, programadas o recientes).
    Activa automáticamente cualquier suscripción programada cuyo plazo ya haya iniciado.
    """
    # Activar suscripciones programadas cuyo momento ya haya llegado
    activate_due_scheduled_subscriptions(db)

    subs = db.query(CustomerSubscription).filter(
        CustomerSubscription.customer_id == customer.id,
        CustomerSubscription.status.in_(["active", "scheduled", "trial", "pending_payment"])
    ).order_by(CustomerSubscription.id.desc()).all()

    now = datetime.utcnow()
    items = []
    for s in subs:
        plan = s.plan
        product = plan.product if plan else None
        remaining = 0
        if s.current_period_end and s.current_period_end > now:
            remaining = max(0, (s.current_period_end.date() - now.date()).days)

        items.append(MySubscriptionItem(
            id=s.id,
            plan_id=s.plan_id,
            plan_name=plan.name if plan else "Plan",
            product_slug=product.slug if product else "crm",
            product_name=product.name if product else "Servicio",
            price_mxn=float(plan.price_mxn) if plan else 0.0,
            billing_interval=plan.billing_interval if plan else "monthly",
            status=s.status,
            current_period_start=s.current_period_start,
            current_period_end=s.current_period_end,
            days_remaining=remaining,
            features_payload=plan.features_payload if plan else {}
        ))

    return items


@router.get("/check-conflict", response_model=ConflictCheckResponse)
def check_plan_conflict(
    plan_id: int = Query(..., description="ID del plan que el cliente desea contratar"),
    db: Session = Depends(get_db),
    customer: Customer = Depends(get_current_customer)
):
    """
    Evalúa si la contratación del plan presenta conflicto con membresías activas.
    Retorna si es Upgrade, Downgrade o Renovación, con el mensaje explicativo para el checkout.
    """
    res = check_subscription_conflict(db=db, customer_id=customer.id, new_plan_id=plan_id)
    return ConflictCheckResponse(**res)


class ClaimTrialResponse(BaseModel):
    status: str
    message: str
    subscription_id: Optional[int] = None


@router.post("/claim-trial", response_model=ClaimTrialResponse)
def claim_free_trial(
    db: Session = Depends(get_db),
    customer: Customer = Depends(get_current_customer)
):
    """
    Activa la membresía de Prueba Gratuita (Free Trial) para el cliente si no cuenta
    con una suscripción activa.
    """
    existing = db.query(CustomerSubscription).filter(
        CustomerSubscription.customer_id == customer.id,
        CustomerSubscription.status.in_(["active", "trial"]),
        CustomerSubscription.current_period_end > datetime.utcnow()
    ).first()

    if existing:
        return ClaimTrialResponse(
            status="already_active",
            message=f"Ya cuentas con una membresía activa ({existing.plan.name}).",
            subscription_id=existing.id
        )

    # Validar que la prueba gratuita no haya sido activada previamente en toda la historia
    if has_customer_used_trial_before(db, customer.id, "crm"):
        return ClaimTrialResponse(
            status="already_used",
            message="La prueba gratuita ya fue utilizada previamente por esta cuenta. Para continuar utilizando el servicio, por favor adquiere una membresía comercial.",
            subscription_id=None
        )

    trial_plan = db.query(MembershipPlan).filter(MembershipPlan.slug == "crm-trial").first()
    if not trial_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El plan de prueba gratuita no está configurado en el catálogo."
        )

    now = datetime.utcnow()
    sub = CustomerSubscription(
        customer_id=customer.id,
        plan_id=trial_plan.id,
        status="trial",
        current_period_start=now,
        current_period_end=calculate_period_end_for_new(now, 30),
        trial_ends_at=calculate_period_end_for_new(now, 30)
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    return ClaimTrialResponse(
        status="activated",
        message="¡Tu período de prueba gratuito ha sido activado exitosamente!",
        subscription_id=sub.id
    )

