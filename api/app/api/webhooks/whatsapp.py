import logging
from fastapi import APIRouter, Request, Query, HTTPException, status, Depends, BackgroundTasks
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.limiter import limiter
from app.lib.security import verify_whatsapp_signature
from app.models.event import Event
from app.models.whatsapp_number import WhatsAppNumber
from app.models.customer_webhook import CustomerWebhook
from app.api.webhooks.dispatcher import dispatch_webhook_with_retries

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/webhooks/whatsapp", tags=["whatsapp-webhook"])

@router.get("", response_class=PlainTextResponse)
@limiter.limit(f"{settings.RATE_LIMIT_PER_SECOND}/second")
async def verify_webhook(
    request: Request,
    mode: str = Query(None, alias="hub.mode"),
    challenge: str = Query(None, alias="hub.challenge"),
    verify_token: str = Query(None, alias="hub.verify_token")
):
    """
    Endpoint para que Meta valide la URL del Webhook.
    Compara el hub.verify_token configurado con el valor local esperado.
    """
    if mode and verify_token:
        if mode == "subscribe" and verify_token == settings.WHATSAPP_VERIFY_TOKEN:
            logger.info("Meta Webhook verificado correctamente.")
            return challenge
        else:
            logger.warning("Fallo en la verificación del Webhook de WhatsApp: Token incorrecto.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Verification token mismatch or invalid mode"
            )
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Missing hub.mode or hub.verify_token query parameters"
    )

@router.post("", dependencies=[Depends(verify_whatsapp_signature)])
@limiter.limit(f"{settings.RATE_LIMIT_PER_SECOND}/second")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Endpoint para recibir el webhook de WhatsApp desde Meta.
    1. Valida la firma digital X-Hub-Signature-256.
    2. Almacena el payload completo en la base de datos para debugging.
    3. Identifica si el phone_number_id pertenece a un cliente registrado.
    4. Si el cliente no tiene webhook URL configurado, lo marca como 'sent'.
    5. Si tiene webhook URL activo, lanza el despacho asíncrono con reintentos (15s, 30s, 60s).
    6. Retorna HTTP 200 OK inmediatamente a Meta (< 3s).
    """
    try:
        payload = await request.json()
    except Exception as parse_err:
        logger.error(f"Payload no válido en webhook de WhatsApp: {parse_err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )

    logger.info(f"Evento de WhatsApp recibido en API Central: {payload}")

    # Extracción de metadatos del webhook
    wa_id = None
    message_id = None
    message_body = None
    phone_number_id = None

    try:
        entry = payload.get("entry", [])
        if entry:
            changes = entry[0].get("changes", [])
            if changes:
                value = changes[0].get("value", {})
                
                # Extraer phone_number_id del receptor de WhatsApp
                metadata = value.get("metadata", {})
                phone_number_id = metadata.get("phone_number_id")

                # Extraer wa_id del remitente
                contacts = value.get("contacts", [])
                if contacts:
                    wa_id = contacts[0].get("wa_id")

                # Extraer datos del primer mensaje si existe
                messages = value.get("messages", [])
                if messages:
                    msg = messages[0]
                    message_id = msg.get("id")
                    msg_type = msg.get("type")
                    if msg_type == "text":
                        message_body = msg.get("text", {}).get("body")
    except Exception as meta_err:
        logger.warning(f"No se pudieron extraer todos los metadatos del payload: {meta_err}")

    # Guardar en base de datos para debugging / trazabilidad histórica
    new_event = Event(
        wa_id=wa_id,
        message_id=message_id,
        message_body=message_body,
        payload=payload,
        delivery_status="pending"
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)

    # Identificar cliente y número registrado
    if phone_number_id:
        wa_number = db.query(WhatsAppNumber).filter(
            WhatsAppNumber.phone_number_id == str(phone_number_id),
            WhatsAppNumber.status == "connected"
        ).first()

        if wa_number:
            new_event.customer_id = wa_number.customer_id
            
            # Consultar webhook destino del cliente
            cust_webhook = db.query(CustomerWebhook).filter(
                CustomerWebhook.customer_id == wa_number.customer_id
            ).first()

            if cust_webhook and cust_webhook.is_active and cust_webhook.url and cust_webhook.url.strip():
                # Cliente tiene URL activa -> Programar despacho asíncrono
                db.commit()
                background_tasks.add_task(
                    dispatch_webhook_with_retries,
                    event_id=new_event.id,
                    webhook_url=cust_webhook.url.strip(),
                    secret_token=cust_webhook.secret_token,
                    payload=payload,
                    customer_id=wa_number.customer_id
                )
                logger.info(f"Despacho programado para cliente #{wa_number.customer_id} hacia '{cust_webhook.url}'")
            else:
                # El cliente NO tiene configurada una URL -> Marcamos como 'sent' para no dejarlo pendiente
                new_event.delivery_status = "sent"
                db.commit()
                logger.info(f"Cliente #{wa_number.customer_id} no tiene webhook configurado. Evento #{new_event.id} marcado como 'sent'.")
        else:
            logger.info(f"Número phone_number_id={phone_number_id} no pertenece a ningún cliente registrado o no está conectado.")
    else:
        logger.info("El payload de WhatsApp no contenía metadata.phone_number_id.")

    # Responder 200 OK inmediatamente a Meta
    return {"status": "success", "id": new_event.id, "delivery_status": new_event.delivery_status}
