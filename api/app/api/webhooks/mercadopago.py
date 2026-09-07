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
from app.api.portal_crm import get_crm_internal_url_and_secret

from app.services.subscription_service import (
    process_subscription_payment_activation,
    record_subscription_payment,
)
from app.services.notifications.manager import NotificationManager

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/webhooks/mercadopago", tags=["mercadopago-webhook"])
legacy_router = APIRouter(prefix="/mercadopago", tags=["mercadopago-webhook"])

@router.post("")
@legacy_router.post("")
async def receive_mercadopago_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Recibe notificaciones automáticas de Mercado Pago (IPN / Webhooks de suscripciones).
    1. Registra cada transacción en la tabla 'payments' para auditoría y trazabilidad.
    2. Si el cobro es aprobado, activa o extiende la vigencia de la membresía.
    3. Si el cobro es rechazado, marca la suscripción como 'past_due', notifica
       inmediatamente al cliente para actualizar su método de pago y alerta a los administradores.
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
    authorized_payment_data = None

    # CASO A: Cobro recurrente de suscripción (authorized_payment)
    if topic in ["subscription_authorized_payment", "authorized_payment"]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"https://api.mercadopago.com/authorized_payments/{resource_id}",
                headers={"Authorization": f"Bearer {mp_token}"}
            )
            if res.status_code == 200:
                pay_data = res.json()
                authorized_payment_data = pay_data
                preapproval_id = pay_data.get("preapproval_id")
            else:
                preapproval_id = str(resource_id)

    # CASO B: Evento de contrato de suscripción (preapproval) o fallback
    elif topic in ["subscription_preapproval", "preapproval"] or not topic:
        preapproval_id = str(resource_id)

    # Procesar la suscripción si tenemos preapproval_id
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
                    # 1. Si el webhook trae datos de cobro recurrente (authorized_payment)
                    if authorized_payment_data:
                        mp_pay_obj = authorized_payment_data.get("payment") or {}
                        pay_status = mp_pay_obj.get("status") or authorized_payment_data.get("status")
                        pay_status_detail = mp_pay_obj.get("status_detail") or authorized_payment_data.get("status_detail") or pay_status
                        mp_pay_id = mp_pay_obj.get("id") or authorized_payment_data.get("payment_id")
                        amount = authorized_payment_data.get("transaction_amount") or (float(sub.plan.price_mxn) if sub.plan else 0.0)

                        # Registrar la transacción en la tabla 'payments'
                        payment_record = record_subscription_payment(
                            db=db,
                            sub=sub,
                            payment_data={
                                "mp_payment_id": str(mp_pay_id) if mp_pay_id else None,
                                "mp_authorized_payment_id": str(resource_id),
                                "mp_preapproval_id": str(preapproval_id),
                                "status": pay_status,
                                "status_detail": pay_status_detail,
                                "amount": amount,
                                "currency": authorized_payment_data.get("currency_id", "MXN"),
                                "payment_method_id": authorized_payment_data.get("payment_method_id"),
                                "payment_type_id": authorized_payment_data.get("payment_type_id"),
                                "card_last_four": (authorized_payment_data.get("card") or {}).get("last_four_digits"),
                                "raw_payload": authorized_payment_data,
                            }
                        )

                        # Si el cobro fue rechazado:
                        if pay_status and pay_status != "approved":
                            sub.status = "past_due"
                            db.commit()
                            logger.warning(f"Cobro recurrente rechazado para sub #{sub.id} (Cliente #{sub.customer_id}): {pay_status_detail}")

                            # Notificación urgente al cliente vía Mailtrap
                            if sub.customer and sub.customer.user and sub.customer.user.email:
                                cust_email = sub.customer.user.email
                                contact = sub.customer.contact_name or sub.customer.company_name
                                company = sub.customer.company_name
                                plan_name = sub.plan.name if sub.plan else "Membresía"
                                try:
                                    NotificationManager.notify_customer_template(
                                        to_email=cust_email,
                                        template_uuid=settings.MAILTRAP_TEMPLATE_PAYMENT_FAILED,
                                        template_variables={
                                            "user_name": contact,
                                            "company": company,
                                            "plan_name": plan_name,
                                            "failure_reason": pay_status_detail or "Fondos insuficientes o rechazo bancario",
                                            "update_payment_url": f"{settings.PORTAL_BASE_URL}/portal/billing",
                                        },
                                        to_name=contact,
                                    )
                                except Exception as err:
                                    logger.error(f"Error enviando notificación de fallo de pago a {cust_email}: {err}")

                            # Alerta operativa a administradores en Telegram
                            try:
                                admin_alert = (
                                    f"🚨 *Fallo en Cobro Recurrente de Membresía*\n\n"
                                    f"• *Cliente:* {sub.customer.company_name if sub.customer else 'ID ' + str(sub.customer_id)}\n"
                                    f"• *Plan:* {sub.plan.name if sub.plan else 'N/A'}\n"
                                    f"• *Motivo:* `{pay_status_detail}`\n"
                                    f"• *Estado:* Marcada como `past_due`. Correo urgente enviado al cliente."
                                )
                                NotificationManager.notify_admins(message=admin_alert, db=db)
                            except Exception as err:
                                logger.error(f"Error alertando a admins sobre fallo de pago: {err}")

                            return {"status": "ok"}

                    # 2. Si el contrato de suscripción está autorizado en Mercado Pago
                    if mp_status == "authorized":
                        act_result = process_subscription_payment_activation(db, sub)
                        logger.info(f"Suscripción #{sub.id} procesada por Mercado Pago: {act_result['action']}")

                        if act_result["action"] in ["activated_immediate", "upgrade_activated", "renewed_active"]:
                            if sub.plan and sub.plan.product and sub.plan.product.slug == "crm" and sub.external_tenant_id:
                                await _sync_features_to_crm(db, sub)

                    # 3. Si el contrato de suscripción fue cancelado en Mercado Pago
                    elif mp_status == "cancelled":
                        sub.status = "cancelled"
                        sub.cancelled_at = datetime.utcnow()
                        db.commit()
                        logger.info(f"Suscripción #{sub.id} cancelada en Mercado Pago.")

    return {"status": "ok"}

async def _sync_features_to_crm(db: Session, sub: CustomerSubscription):
    """Función auxiliar para despachar los límites de la membresía al CRM."""
    try:
        service_url, secret = get_crm_internal_url_and_secret(db)

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
