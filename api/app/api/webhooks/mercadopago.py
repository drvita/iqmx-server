import logging
from datetime import datetime, timedelta
import httpx
from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.customer_subscription import CustomerSubscription
from app.models.product import Product
from app.config import settings
from app.lib.crypto import decrypt_token

from app.services.subscription_service import process_subscription_payment_activation

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/webhooks/mercadopago", tags=["mercadopago-webhook"])

@router.post("")
async def receive_mercadopago_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Recibe notificaciones automáticas de Mercado Pago (IPN / Webhooks de suscripciones).
    Al confirmar el cobro/autorización de una membresía, ejecuta las reglas de negocio
    para Upgrades (sustitución inmediata) o Downgrades (programadas al terminar la actual),
    calculando vigencias a medianoche y sincronizando los límites con el CRM.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    topic = (
        request.query_params.get("type")
        or request.query_params.get("topic")
        or (body.get("type") if isinstance(body, dict) else None)
        or (body.get("topic") if isinstance(body, dict) else None)
        or (body.get("action") if isinstance(body, dict) else None)
    )
    resource_id = (
        request.query_params.get("data.id")
        or request.query_params.get("id")
        or (body.get("data", {}).get("id") if isinstance(body, dict) and isinstance(body.get("data"), dict) else None)
        or (body.get("id") if isinstance(body, dict) else None)
    )

    logger.info(f"Webhook recibido de Mercado Pago: topic={topic}, id={resource_id}")

    mp_token = settings.MERCADOPAGO_ACCESS_TOKEN
    if not mp_token or not resource_id:
        return {"status": "ok"}

    preapproval_id = None

    # CASO A: Cobro recurrente de suscripción (authorized_payment)
    if topic in ["subscription_authorized_payment", "authorized_payment"]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"https://api.mercadopago.com/authorized_payments/{resource_id}",
                headers={"Authorization": f"Bearer {mp_token}"}
            )
            if res.status_code == 200:
                pay_data = res.json()
                pay_status = pay_data.get("payment", {}).get("status") or pay_data.get("status")
                preapproval_id = pay_data.get("preapproval_id")
                if pay_status and pay_status != "approved":
                    logger.info(f"Pago autorizado #{resource_id} no aprobado: {pay_status}")
                    return {"status": "ok"}
            else:
                # Si falla como authorized_payment, probar si resource_id es preapproval_id
                preapproval_id = str(resource_id)

    # CASO B: Evento de contrato de suscripción (preapproval) o fallback
    elif topic in ["subscription_preapproval", "preapproval"] or not topic:
        preapproval_id = str(resource_id)

    # Procesar y activar la suscripción si tenemos preapproval_id
    if preapproval_id:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"https://api.mercadopago.com/preapproval/{preapproval_id}",
                headers={"Authorization": f"Bearer {mp_token}"}
            )
            if res.status_code == 200:
                mp_data = res.json()
                mp_status = mp_data.get("status")  # 'authorized', 'paused', 'cancelled'
                ext_ref = mp_data.get("external_reference") or ""

                # Buscar suscripción local por preapproval_id o por external_reference
                sub = db.query(CustomerSubscription).filter(
                    CustomerSubscription.mp_preapproval_id == str(preapproval_id)
                ).first()

                if not sub and "sub_" in ext_ref:
                    try:
                        sub_id = int(ext_ref.split("_")[1])
                        sub = db.query(CustomerSubscription).filter(CustomerSubscription.id == sub_id).first()
                        if sub and not sub.mp_preapproval_id:
                            sub.mp_preapproval_id = str(preapproval_id)
                            db.commit()
                    except Exception:
                        pass

                if sub:
                    if mp_status == "authorized":
                        act_result = process_subscription_payment_activation(db, sub)
                        logger.info(f"Suscripción #{sub.id} procesada por Mercado Pago: {act_result['action']}")

                        if act_result["action"] in ["activated_immediate", "upgrade_activated"]:
                            if sub.plan and sub.plan.product and sub.plan.product.slug == "crm" and sub.external_tenant_id:
                                await _sync_features_to_crm(db, sub)

                    elif mp_status == "cancelled":
                        sub.status = "cancelled"
                        sub.cancelled_at = datetime.utcnow()
                        db.commit()
                        logger.info(f"Suscripción #{sub.id} cancelada en Mercado Pago.")

    return {"status": "ok"}

async def _sync_features_to_crm(db: Session, sub: CustomerSubscription):
    """Función auxiliar para despachar los límites de la membresía al CRM."""
    try:
        crm_product = db.query(Product).filter(Product.slug == "crm").first()
        service_url = crm_product.service_url if (crm_product and crm_product.service_url) else settings.CRM_SERVICE_URL
        secret = settings.CRM_PROVISION_SECRET
        if crm_product and crm_product.api_secret_encrypted:
            try:
                secret = decrypt_token(crm_product.api_secret_encrypted, settings.TOKEN_ENCRYPTION_KEY)
            except Exception:
                pass

        features = dict(sub.plan.features_payload)
        if sub.custom_features_override:
            features.update(sub.custom_features_override)

        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{service_url}/api/provision/tenant/{sub.external_tenant_id}/features"
            await client.patch(
                url,
                json=features,
                headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"}
            )
            logger.info(f"Límites de membresía despachados automáticamente al CRM para tenant {sub.external_tenant_id}")
    except Exception as e:
        logger.error(f"Error sincronizando membresía con CRM tras pago: {e}")
