from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import logging
import time
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.portal_auth import get_current_customer
from app.api.portal_crm import generate_temporary_password
from app.config import settings
from app.db.database import get_db
from app.lib.crypto import decrypt_token
from app.models.customer import Customer
from app.models.customer_subscription import CustomerSubscription
from app.models.membership_plan import MembershipPlan
from app.models.product import Product
from app.services.subscription_service import has_customer_used_trial_before

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/portal/checador", tags=["portal-checador"])


class ChecadorSubscriptionSummary(BaseModel):
    plan_slug: str
    plan_name: str
    price_mxn: float
    status: str
    trial_ends_at: Optional[str] = None
    current_period_end: Optional[str] = None
    features: Dict[str, Any] = {}


class ChecadorStatusResponse(BaseModel):
    checador_registered: bool
    checador_organization_id: Optional[str] = None
    checador_organization_name: Optional[str] = None
    checador_owner_email: Optional[str] = None
    service_url: str
    has_used_trial_before: bool = False
    subscription: Optional[ChecadorSubscriptionSummary] = None


class RegisterChecadorAccountResponse(BaseModel):
    ok: bool
    status: str
    message: str
    checador_registered: bool
    checador_organization_id: Optional[str] = None
    checador_organization_name: Optional[str] = None
    checador_owner_email: Optional[str] = None
    service_url: str
    temp_password: Optional[str] = None
    must_change_password: bool = False


class ResetChecadorPasswordResponse(BaseModel):
    ok: bool
    message: str
    temp_password: Optional[str] = None
    checador_owner_email: Optional[str] = None
    must_change_password: bool = True


class CancelChecadorAccountResponse(BaseModel):
    ok: bool
    message: str
    status: str


def get_checador_internal_url_and_secret(db: Session) -> tuple[str, str]:
    """Obtiene la URL interna M2M y el secreto de aprovisionamiento de Checador."""
    prod = db.query(Product).filter(Product.slug == "checador").first()
    internal_url = settings.CHECADOR_SERVICE_URL or (
        prod.service_url if prod and prod.service_url else "http://checador:3000"
    )

    if (
        settings.CHECADOR_PROVISION_SECRET
        and settings.CHECADOR_PROVISION_SECRET != "checador_provision_secret_key_iqmx_default"
    ):
        secret = settings.CHECADOR_PROVISION_SECRET
    elif prod and prod.api_secret_encrypted:
        try:
            secret = decrypt_token(prod.api_secret_encrypted, settings.TOKEN_ENCRYPTION_KEY)
        except Exception as e:
            logger.warning(f"No fue posible descifrar token M2M de Checador: {e}")
            secret = settings.CHECADOR_PROVISION_SECRET
    else:
        secret = settings.CHECADOR_PROVISION_SECRET

    return internal_url.rstrip("/"), secret


def build_signed_headers(secret: str, raw_body: str) -> Dict[str, str]:
    """Construye cabeceras HMAC-SHA256 + x-provision-key compatibles con checador."""
    ts = str(int(time.time()))
    sig = hmac.new(
        secret.encode("utf-8"),
        f"{ts}.{raw_body}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {
        "Content-Type": "application/json",
        "x-provision-key": secret,
        "x-provision-timestamp": ts,
        "x-provision-signature": sig,
    }


def _get_public_checador_url() -> str:
    base = settings.PORTAL_BASE_URL.rstrip("/")
    if "localhost:3001" in base or "127.0.0.1:3001" in base:
        return base.replace(":3001", ":3002")
    return "https://checador.iqissmexico.com"


def _get_customer_checador_sub(db: Session, customer_id: int) -> Optional[CustomerSubscription]:
    prod = db.query(Product).filter(Product.slug == "checador").first()
    if not prod:
        return None
    return (
        db.query(CustomerSubscription)
        .join(MembershipPlan, CustomerSubscription.plan_id == MembershipPlan.id)
        .filter(
            CustomerSubscription.customer_id == customer_id,
            MembershipPlan.product_id == prod.id,
        )
        .order_by(CustomerSubscription.id.desc())
        .first()
    )


@router.get("/status", response_model=ChecadorStatusResponse)
def get_checador_status(
    customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    sub = _get_customer_checador_sub(db, customer.id)
    used_trial = has_customer_used_trial_before(db, customer.id)
    service_url = _get_public_checador_url()

    summary: Optional[ChecadorSubscriptionSummary] = None
    if sub and sub.plan:
        summary = ChecadorSubscriptionSummary(
            plan_slug=sub.plan.slug,
            plan_name=sub.plan.name,
            price_mxn=float(sub.plan.price_mxn or 0),
            status=sub.status,
            trial_ends_at=sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
            current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
            features=sub.plan.features_payload or {},
        )

    owner_email = customer.user.email if customer.user else ""
    registered = bool(sub and sub.external_tenant_id)
    return ChecadorStatusResponse(
        checador_registered=registered,
        checador_organization_id=sub.external_tenant_id if sub else None,
        checador_organization_name=customer.company_name or customer.contact_name if registered else None,
        checador_owner_email=owner_email if registered else None,
        service_url=service_url,
        has_used_trial_before=used_trial,
        subscription=summary,
    )


@router.post("/register-account", response_model=RegisterChecadorAccountResponse)
async def register_checador_account(
    customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    prod = db.query(Product).filter(Product.slug == "checador").first()
    if not prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El producto Checador Facial aún no está configurado en el catálogo.",
        )

    owner_email = customer.user.email if customer.user else ""
    existing_sub = _get_customer_checador_sub(db, customer.id)
    service_url = _get_public_checador_url()
    if existing_sub and existing_sub.external_tenant_id:
        return RegisterChecadorAccountResponse(
            ok=True,
            status="already_registered",
            message="Tu cuenta de Checador Facial ya se encuentra activa.",
            checador_registered=True,
            checador_organization_id=existing_sub.external_tenant_id,
            checador_organization_name=customer.company_name or customer.contact_name,
            checador_owner_email=owner_email,
            service_url=service_url,
        )

    used_trial = has_customer_used_trial_before(db, customer.id)
    trial_plan = db.query(MembershipPlan).filter(
        MembershipPlan.product_id == prod.id,
        MembershipPlan.slug == "checador-trial",
    ).first()
    basic_plan = db.query(MembershipPlan).filter(
        MembershipPlan.product_id == prod.id,
        MembershipPlan.slug == "checador-basic",
    ).first()

    selected_plan = trial_plan if (not used_trial and trial_plan) else (basic_plan or trial_plan)
    if not selected_plan:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No hay planes configurados para Checador Facial.",
        )

    now = datetime.now(timezone.utc)
    is_trial = selected_plan.slug == "checador-trial"
    trial_end = now + timedelta(days=30) if is_trial else None
    temp_password = generate_temporary_password()
    features = selected_plan.features_payload or {}

    m2m_url, secret = get_checador_internal_url_and_secret(db)
    payload = {
        "externalCustomerId": str(customer.id),
        "companyName": customer.company_name or f"Empresa de {customer.contact_name}",
        "ownerName": customer.contact_name,
        "ownerEmail": owner_email,
        "password": temp_password,
        "status": "trial" if is_trial else "active",
        "features": {
            "planCodigo": features.get("plan_codigo", "trial" if is_trial else "basico"),
            "maxEmpleados": int(features.get("max_empleados", 15)),
            "maxDispositivos": int(features.get("max_dispositivos", 2)),
            "maxSucursales": int(features.get("max_sucursales", 1)),
            "cloudEvidencesEnabled": bool(features.get("cloud_evidences_enabled", False)),
            "extraRolesEnabled": bool(features.get("extra_roles_enabled", False)),
            "horasSemanalesMax": float(features.get("horas_semanales_max", 48)),
        },
    }

    raw_body = json.dumps(payload)
    headers = build_signed_headers(secret, raw_body)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{m2m_url}/api/provision/tenant",
                content=raw_body,
                headers=headers,
            )
    except httpx.RequestError as exc:
        logger.error(f"Error de conexión M2M hacia Checador: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No fue posible conectar con el servicio de Checador Facial.",
        )

    if resp.status_code >= 400:
        logger.error(f"Checador devolvió {resp.status_code}: {resp.text}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="El servicio de Checador Facial rechazó el aprovisionamiento.",
        )

    data = resp.json()
    org_id = data.get("organizationId") or (data.get("organization") or {}).get("id")
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Respuesta inesperada del servicio de Checador Facial.",
        )

    sub = existing_sub or CustomerSubscription(
        customer_id=customer.id,
        plan_id=selected_plan.id,
        status="trial" if is_trial else "active",
        trial_ends_at=trial_end,
        current_period_start=now,
        current_period_end=trial_end or (now + timedelta(days=30)),
        external_tenant_id=str(org_id),
    )
    if existing_sub:
        existing_sub.external_tenant_id = str(org_id)
        existing_sub.plan_id = selected_plan.id
        existing_sub.status = "trial" if is_trial else "active"
        existing_sub.trial_ends_at = trial_end
    else:
        db.add(sub)

    db.commit()

    return RegisterChecadorAccountResponse(
        ok=True,
        status="registered_with_trial" if is_trial else "registered_with_active_plan",
        message="Tu cuenta de Checador Facial fue creada exitosamente.",
        checador_registered=True,
        checador_organization_id=str(org_id),
        checador_organization_name=payload["companyName"],
        checador_owner_email=owner_email,
        service_url=service_url,
        temp_password=temp_password,
        must_change_password=True,
    )


@router.post("/reset-password", response_model=ResetChecadorPasswordResponse)
async def reset_checador_password(
    customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    sub = _get_customer_checador_sub(db, customer.id)
    if not sub or not sub.external_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tienes una cuenta de Checador Facial registrada.",
        )

    owner_email = customer.user.email if customer.user else ""
    temp_password = generate_temporary_password()
    m2m_url, secret = get_checador_internal_url_and_secret(db)
    raw_body = json.dumps(
        {
            "organizationId": sub.external_tenant_id,
            "ownerEmail": owner_email,
            "newPassword": temp_password,
        }
    )
    headers = build_signed_headers(secret, raw_body)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{m2m_url}/api/provision/reset-owner-password",
            content=raw_body,
            headers=headers,
        )

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No fue posible restablecer la contraseña en Checador Facial.",
        )

    return ResetChecadorPasswordResponse(
        ok=True,
        message="Contraseña temporal generada correctamente.",
        temp_password=temp_password,
        checador_owner_email=owner_email,
        must_change_password=True,
    )


@router.post("/cancel-account", response_model=CancelChecadorAccountResponse)
async def cancel_checador_account(
    customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    sub = _get_customer_checador_sub(db, customer.id)
    if not sub or not sub.external_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tienes una cuenta de Checador Facial registrada.",
        )

    m2m_url, secret = get_checador_internal_url_and_secret(db)
    raw_body = json.dumps(
        {
            "status": "cancelled",
            "reason": "Cancelado por el cliente desde el portal",
        }
    )
    headers = build_signed_headers(secret, raw_body)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.patch(
            f"{m2m_url}/api/provision/tenant/{sub.external_tenant_id}/status",
            content=raw_body,
            headers=headers,
        )

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No fue posible cancelar el acceso en Checador Facial.",
        )

    sub.status = "cancelled"
    sub.cancelled_at = datetime.now(timezone.utc)
    db.commit()

    return CancelChecadorAccountResponse(
        ok=True,
        message="Tu suscripción de Checador Facial fue cancelada. Tus datos se conservan resguardados salvo que solicites eliminación manual.",
        status="cancelled",
    )
