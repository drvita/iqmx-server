from datetime import datetime
from typing import Optional, Dict, Any
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.customer import Customer
from app.models.customer_subscription import CustomerSubscription
from app.models.customer_webhook import CustomerWebhook
from app.models.membership_plan import MembershipPlan
from app.models.product import Product
from app.api.portal_auth import get_current_customer
from app.config import settings
from app.lib.crypto import decrypt_token
from app.services.subscription_service import (
    calculate_period_end_for_new,
    has_customer_used_trial_before,
    get_customer_crm_info,
)

import secrets
import string

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/portal/crm", tags=["portal-crm"])


def generate_temporary_password(length: int = 12) -> str:
    """Genera una contraseña temporal segura con mayúsculas, minúsculas, dígitos y caracteres especiales."""
    upper = string.ascii_uppercase
    lower = string.ascii_lowercase
    digits = string.digits
    specials = "!@#$*"
    chars = [
        secrets.choice(upper),
        secrets.choice(lower),
        secrets.choice(digits),
        secrets.choice(specials),
    ] + [secrets.choice(upper + lower + digits + specials) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


class CrmStatusResponse(BaseModel):
    crm_registered: bool
    crm_organization_id: Optional[str] = None
    crm_organization_name: Optional[str] = None
    crm_owner_email: Optional[str] = None
    service_url: Optional[str] = None
    has_used_trial_before: bool = False
    temp_password: Optional[str] = None
    must_change_password: bool = False


class RegisterCrmAccountResponse(BaseModel):
    ok: bool
    status: str  # 'registered_with_trial', 'registered_with_active_plan', 'registered_without_trial', 'already_registered'
    message: str
    crm_registered: bool
    crm_organization_id: Optional[str] = None
    crm_organization_name: Optional[str] = None
    crm_owner_email: Optional[str] = None
    service_url: Optional[str] = None
    temp_password: Optional[str] = None
    must_change_password: bool = False


def get_crm_internal_url_and_secret(db: Session) -> tuple[str, str]:
    """
    Retorna la URL interna de comunicación M2M con el CRM y la clave secreta descifrada.
    Prioridad:
    1. Variable de entorno explícita (CRM_PROVISION_SECRET / CRM_SERVICE_URL).
    2. Base de datos (Product.api_secret_encrypted / Product.service_url).
    3. Valores predeterminados del sistema.
    """
    crm_product = db.query(Product).filter(Product.slug == "crm").first()
    internal_url = settings.CRM_SERVICE_URL or (crm_product.service_url if crm_product and crm_product.service_url else "http://crm:3000")

    # Si se definió explícitamente en el entorno, tiene prioridad sobre la BD
    if settings.CRM_PROVISION_SECRET and settings.CRM_PROVISION_SECRET != "crm_provision_secret_key_iqmx_default":
        secret = settings.CRM_PROVISION_SECRET
    elif crm_product and crm_product.api_secret_encrypted:
        try:
            secret = decrypt_token(crm_product.api_secret_encrypted, settings.TOKEN_ENCRYPTION_KEY)
        except Exception as e:
            logger.warning(f"No fue posible descifrar token M2M del producto CRM: {e}")
            secret = settings.CRM_PROVISION_SECRET or "crm_provision_secret_key_iqmx_default"
    else:
        secret = settings.CRM_PROVISION_SECRET or "crm_provision_secret_key_iqmx_default"

    return internal_url.rstrip("/"), secret


def sync_customer_crm_webhook(db: Session, customer_id: int, webhook_token: str, m2m_url: str):
    """
    Sincroniza y establece por defecto la configuración de webhook y aprovisionamiento del CRM
    en la tabla customer_webhooks para que cualquier línea conectada funcione de inmediato.
    """
    if not webhook_token:
        return

    final_webhook_url = f"{m2m_url}/api/webhooks/wa/{webhook_token}"
    final_provision_url = f"{m2m_url}/api/settings/whatsapp/provision"

    cust_wh = db.query(CustomerWebhook).filter(
        CustomerWebhook.customer_id == customer_id
    ).first()

    if cust_wh:
        cust_wh.url = final_webhook_url
        cust_wh.provision_url = final_provision_url
        cust_wh.secret_token = webhook_token
        cust_wh.is_active = True
        cust_wh.updated_at = datetime.utcnow()
    else:
        cust_wh = CustomerWebhook(
            customer_id=customer_id,
            url=final_webhook_url,
            provision_url=final_provision_url,
            secret_token=webhook_token,
            is_active=True
        )
        db.add(cust_wh)
    try:
        db.commit()
        logger.info(f"CustomerWebhook sincronizado con éxito para cliente #{customer_id}")
    except Exception as e:
        db.rollback()
        logger.warning(f"No fue posible guardar CustomerWebhook automático: {e}")


@router.get("/status", response_model=CrmStatusResponse)
def get_crm_status(
    db: Session = Depends(get_db),
    customer: Customer = Depends(get_current_customer)
):
    """
    Consulta el estado de registro del cliente en la aplicación CRM, su URL de acceso
    y credenciales temporales si aún no ha realizado su primer login.
    """
    crm_product = db.query(Product).filter(Product.slug == "crm").first()
    service_url = crm_product.service_url if crm_product else None

    cust_email = customer.user.email if customer.user else None
    crm_info = get_customer_crm_info(db, customer.id, cust_email)
    has_used_trial = has_customer_used_trial_before(db, customer.id, "crm")

    if crm_info["crm_registered"] and crm_info.get("webhook_token"):
        m2m_url, _ = get_crm_internal_url_and_secret(db)
        sync_customer_crm_webhook(db, customer.id, crm_info["webhook_token"], m2m_url)

    return CrmStatusResponse(
        crm_registered=crm_info["crm_registered"],
        crm_organization_id=crm_info["crm_organization_id"],
        crm_organization_name=crm_info["crm_organization_name"],
        crm_owner_email=crm_info["crm_owner_email"],
        service_url=service_url,
        has_used_trial_before=has_used_trial,
        temp_password=crm_info.get("temp_password"),
        must_change_password=crm_info.get("must_change_password", False),
    )


@router.post("/register-account", response_model=RegisterCrmAccountResponse)
async def register_crm_account(
    db: Session = Depends(get_db),
    customer: Customer = Depends(get_current_customer)
):
    """
    Aprovisiona y registra automáticamente al cliente en la plataforma CRM oficial
    asignando una contraseña temporal para su primer login.
    """
    crm_product = db.query(Product).filter(Product.slug == "crm").first()
    browser_service_url = crm_product.service_url if crm_product else None
    cust_email = customer.user.email if customer.user else ""

    # Generar contraseña temporal segura
    temp_password = generate_temporary_password(12)

    # 1. Despachar aprovisionamiento M2M hacia el CRM con la contraseña temporal
    m2m_url, m2m_secret = get_crm_internal_url_and_secret(db)
    provision_endpoint = f"{m2m_url}/api/provision/tenant"

    payload = {
        "externalCustomerId": f"iqmx_cust_{customer.id}",
        "companyName": customer.company_name or "Mi Empresa",
        "ownerEmail": cust_email,
        "ownerName": customer.company_name or "Administrador",
        "password": temp_password,
        "status": "active"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {
                "Authorization": f"Bearer {m2m_secret}",
                "Content-Type": "application/json"
            }
            res = await client.post(provision_endpoint, json=payload, headers=headers)
            if res.status_code not in (200, 201):
                logger.error(f"Fallo al aprovisionar tenant en CRM: HTTP {res.status_code} - {res.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"El servicio CRM rechazó el registro: {res.text}"
                )
            crm_res = res.json()
    except httpx.RequestError as exc:
        logger.error(f"Error de red contactando servicio CRM en '{provision_endpoint}': {type(exc).__name__} - {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No fue posible comunicarse con el servicio CRM en '{provision_endpoint}': {type(exc).__name__} - {exc}"
        )

    org_data = crm_res.get("organization", {})
    owner_data = crm_res.get("owner", {})
    org_id = org_data.get("id")
    org_name = org_data.get("name") or customer.company_name
    owner_email = owner_data.get("email") or cust_email

    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="La respuesta del servicio CRM no incluyó un ID de organización válido."
        )

    # 3. Configurar automáticamente el CustomerWebhook del cliente hacia el CRM
    webhook_data = crm_res.get("webhook", {})
    webhook_token = webhook_data.get("token")
    if webhook_token:
        sync_customer_crm_webhook(db, customer.id, webhook_token, m2m_url)

    # 4. Vincular con suscripción existente o evaluar prueba gratuita
    now = datetime.utcnow()
    active_sub = db.query(CustomerSubscription).join(
        MembershipPlan, CustomerSubscription.plan_id == MembershipPlan.id
    ).join(
        Product, MembershipPlan.product_id == Product.id
    ).filter(
        CustomerSubscription.customer_id == customer.id,
        CustomerSubscription.status.in_(["active", "trial"]),
        CustomerSubscription.current_period_end > now,
        Product.slug == "crm"
    ).order_by(CustomerSubscription.current_period_end.desc()).first()

    features_to_sync: Optional[Dict[str, Any]] = None
    ret_status = "already_registered"
    ret_message = ""

    if active_sub:
        active_sub.external_tenant_id = org_id
        db.commit()
        db.refresh(active_sub)

        features = dict(active_sub.plan.features_payload or {})
        if active_sub.custom_features_override:
            features.update(active_sub.custom_features_override)
        features_to_sync = features

        ret_status = "registered_with_active_plan"
        ret_message = f"¡Tu cuenta en el CRM ha sido creada y vinculada a tu plan activo ({active_sub.plan.name})!"
    else:
        has_used_trial = has_customer_used_trial_before(db, customer.id, "crm")
        if has_used_trial:
            ret_status = "registered_without_trial"
            ret_message = (
                "Tu cuenta en el CRM fue creada exitosamente. Dado que la prueba gratuita ya fue "
                "utilizada previamente por esta cuenta, por favor adquiere una membresía comercial "
                "para habilitar todas las líneas y operadores."
            )
        else:
            trial_plan = db.query(MembershipPlan).filter(MembershipPlan.slug == "crm-trial").first()
            if trial_plan:
                period_end = calculate_period_end_for_new(now, 30)
                new_sub = CustomerSubscription(
                    customer_id=customer.id,
                    plan_id=trial_plan.id,
                    status="trial",
                    current_period_start=now,
                    current_period_end=period_end,
                    trial_ends_at=period_end,
                    external_tenant_id=org_id
                )
                db.add(new_sub)
                db.commit()
                db.refresh(new_sub)

                features_to_sync = dict(trial_plan.features_payload or {})
                ret_status = "registered_with_trial"
                ret_message = (
                    "¡Tu cuenta en el CRM y tu período de Prueba Gratuita (30 días) "
                    "han sido activados exitosamente!"
                )
            else:
                ret_status = "registered_without_trial"
                ret_message = "Tu cuenta en el CRM fue creada exitosamente."

    # 4. Sincronizar límites con el CRM si hay plan activo o trial
    if features_to_sync:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                sync_url = f"{m2m_url}/api/provision/tenant/{org_id}/features"
                headers = {
                    "Authorization": f"Bearer {m2m_secret}",
                    "Content-Type": "application/json"
                }
                res_sync = await client.patch(sync_url, json=features_to_sync, headers=headers)
                if res_sync.status_code == 200:
                    logger.info(f"Límites sincronizados exitosamente para org {org_id}")
                else:
                    logger.warning(f"Respuesta inesperada al sincronizar límites de {org_id}: {res_sync.status_code}")
        except Exception as e:
            logger.warning(f"No fue posible sincronizar límites con el CRM en este momento: {e}")

    return RegisterCrmAccountResponse(
        ok=True,
        status=ret_status,
        message=ret_message,
        crm_registered=True,
        crm_organization_id=org_id,
        crm_organization_name=org_name,
        crm_owner_email=owner_email,
        service_url=browser_service_url,
        temp_password=temp_password,
        must_change_password=True,
    )
