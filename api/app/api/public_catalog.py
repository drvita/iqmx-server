import logging
from datetime import datetime, timedelta
import re
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from app.db.database import get_db
from app.models.product import Product
from app.models.membership_plan import MembershipPlan
from app.models.customer import Customer
from app.models.customer_subscription import CustomerSubscription
from app.models.user import User
from app.models.role import Role
from app.lib.security import hash_password
from app.config import settings

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/public", tags=["public-catalog"])

EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"

# --- Schemas ---

class PublicProductResponse(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str] = None
    landing_path: Optional[str] = None
    has_memberships: bool = False

class PublicPlanResponse(BaseModel):
    id: int
    product_id: int
    name: str
    slug: str
    description: Optional[str] = None
    price_mxn: float
    billing_interval: str
    features_payload: Dict[str, Any]

class PublicCheckoutRequest(BaseModel):
    plan_id: int
    company_name: str = Field(..., min_length=2, max_length=150)
    contact_name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=150)
    phone: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(EMAIL_REGEX, clean):
            raise ValueError("El correo electrónico no tiene un formato válido.")
        return clean

class PublicCheckoutResponse(BaseModel):
    subscription_id: int
    checkout_url: str
    status: str

# --- Endpoints ---

@router.get("/products", response_model=List[PublicProductResponse])
def list_public_products(
    db: Session = Depends(get_db)
):
    """Lista todos los productos públicos activos para la página raíz."""
    products = db.query(Product).filter(Product.is_active == True).order_by(Product.id.asc()).all()
    return [
        PublicProductResponse(
            id=p.id,
            slug=p.slug,
            name=p.name,
            description=p.description,
            landing_path=p.landing_path,
            has_memberships=len(p.plans) > 0
        )
        for p in products
    ]

@router.get("/products/{slug_or_id}", response_model=PublicProductResponse)
def get_public_product(
    slug_or_id: str,
    db: Session = Depends(get_db)
):
    """
    Obtiene la información pública de un producto (sin credenciales internas ni URLs de infraestructura).
    """
    query = db.query(Product).filter(Product.is_active == True)
    if slug_or_id.isdigit():
        product = query.filter(Product.id == int(slug_or_id)).first()
    else:
        product = query.filter(Product.slug == slug_or_id.strip().lower()).first()

    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado o inactivo.")

    return PublicProductResponse(
        id=product.id,
        slug=product.slug,
        name=product.name,
        description=product.description,
        landing_path=product.landing_path,
        has_memberships=len(product.plans) > 0
    )

@router.get("/products/{slug_or_id}/plans", response_model=List[PublicPlanResponse])
def get_public_plans(
    slug_or_id: str,
    include_free: bool = False,
    agenda: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """
    Lista los planes públicos de un producto con filtrado opcional.
    - include_free=true: Incluye planes de $0 (ej. Trial). Por defecto se excluyen.
    - agenda=true: Solo planes con agenda habilitada. agenda=false: Solo sin agenda.
    """
    query = db.query(Product).filter(Product.is_active == True)
    if slug_or_id.isdigit():
        product = query.filter(Product.id == int(slug_or_id)).first()
    else:
        product = query.filter(Product.slug == slug_or_id.strip().lower()).first()

    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    # Base: planes activos y públicos
    plans_query = db.query(MembershipPlan).filter(
        MembershipPlan.product_id == product.id,
        MembershipPlan.is_active == True,
        MembershipPlan.is_public == True,
    )

    # Filtrar planes gratis salvo que se solicite explícitamente
    if not include_free:
        plans_query = plans_query.filter(MembershipPlan.price_mxn > 0)

    plans = plans_query.order_by(MembershipPlan.price_mxn.asc()).all()

    # Filtrar por agenda_enabled en el JSON de features (post-query para compatibilidad)
    if agenda is not None:
        plans = [
            p for p in plans
            if (p.features_payload or {}).get("agenda_enabled") == agenda
        ]

    return [
        PublicPlanResponse(
            id=p.id,
            product_id=p.product_id,
            name=p.name,
            slug=p.slug,
            description=p.description,
            price_mxn=float(p.price_mxn),
            billing_interval=p.billing_interval,
            features_payload=p.features_payload or {}
        )
        for p in plans
    ]

@router.post("/checkout/preference", response_model=PublicCheckoutResponse)
async def create_checkout_preference(
    req: PublicCheckoutRequest,
    db: Session = Depends(get_db)
):
    """
    Inicia el proceso de contratación y genera la URL de checkout de Mercado Pago
    para que el cliente autorice el pago recurrente de su membresía.
    """
    plan = db.query(MembershipPlan).filter(
        MembershipPlan.id == req.plan_id,
        MembershipPlan.is_active == True
    ).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado o no disponible.")

    if float(plan.price_mxn) <= 0:
        raise HTTPException(
            status_code=400,
            detail="Las membresías gratuitas no requieren proceso de cobro en Mercado Pago."
        )

    clean_email = req.email.strip().lower()

    # 1. Buscar o registrar al usuario y cliente
    user = db.query(User).filter(User.email == clean_email).first()
    customer_role = db.query(Role).filter(Role.name == "customer").first()

    if not user:
        # Generar usuario para el cliente
        user = User(
            name=req.contact_name.strip(),
            email=clean_email,
            password_hash=hash_password("Temporal123!"),  # Se invitará a crear su propia clave
            role_id=customer_role.id if customer_role else None
        )
        if customer_role:
            user.roles.append(customer_role)
        db.add(user)
        db.commit()
        db.refresh(user)

    customer = db.query(Customer).filter(Customer.user_id == user.id).first()
    if not customer:
        customer = Customer(
            user_id=user.id,
            company_name=req.company_name.strip(),
            contact_name=req.contact_name.strip(),
            phone=req.phone.strip() if req.phone else None,
            origin="web_checkout",
            is_active=True,
            privacy_accepted_at=datetime.utcnow()
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

    # 2. Registrar la suscripción en estado 'pending_payment'
    now = datetime.utcnow()
    sub = CustomerSubscription(
        customer_id=customer.id,
        plan_id=plan.id,
        status="pending_payment",
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    # 3. Invocar API de Mercado Pago (Suscripciones / Preapproval)
    mp_token = settings.MERCADOPAGO_ACCESS_TOKEN
    if not mp_token:
        # Simulación amigable en desarrollo local sin credenciales reales
        mock_checkout = f"https://www.mercadopago.com.mx/subscriptions/checkout?pref_id=mock_{sub.id}"
        sub.mp_preapproval_id = f"mock_preapproval_{sub.id}"
        db.commit()
        return PublicCheckoutResponse(
            subscription_id=sub.id,
            checkout_url=mock_checkout,
            status="pending_payment"
        )

    # Llamada real a Mercado Pago
    url = "https://api.mercadopago.com/preapproval"
    payload = {
        "reason": f"{plan.name} - IQISSMexico",
        "auto_recurring": {
            "frequency": 1,
            "frequency_type": "months",
            "transaction_amount": float(plan.price_mxn),
            "currency_id": "MXN"
        },
        "payer_email": clean_email,
        "back_url": "https://iqissmexico.com/portal/dashboard?payment=success",
        "external_reference": f"sub_{sub.id}_cust_{customer.id}"
    }
    headers = {
        "Authorization": f"Bearer {mp_token}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(url, json=payload, headers=headers)
        if res.status_code not in [200, 201]:
            logger.error(f"Fallo creando preferencia de Mercado Pago: {res.status_code} {res.text}")
            raise HTTPException(
                status_code=502,
                detail="No fue posible generar el enlace de pago con Mercado Pago en este momento."
            )
        data = res.json()
        preapproval_id = data.get("id")
        init_point = data.get("init_point")

        sub.mp_preapproval_id = preapproval_id
        db.commit()

        return PublicCheckoutResponse(
            subscription_id=sub.id,
            checkout_url=init_point,
            status="pending_payment"
        )
