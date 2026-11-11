import logging
import hmac
import hashlib
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Request, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.config import settings
from app.models.prospecting import ProspectingBusiness, ProspectingSource

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/webhooks/mailtrap", tags=["mailtrap-webhook"])
legacy_router = APIRouter(prefix="/mailtrap", tags=["mailtrap-webhook"])


def verify_mailtrap_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """
    Valida la firma criptográfica HMAC-SHA256 enviada por Mailtrap en la cabecera 'Mailtrap-Signature'.
    Si MAILTRAP_WEBHOOK_SECRET no está configurada, permite la recepción (para modo pruebas/dev).
    """
    secret = getattr(settings, "MAILTRAP_WEBHOOK_SECRET", None)
    if not secret or not str(secret).strip():
        return True

    if not signature_header:
        return False

    computed = hmac.new(
        key=secret.strip().encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(computed, signature_header)


@router.post("")
@legacy_router.post("")
async def receive_mailtrap_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Recibe notificaciones automáticas de eventos de Mailtrap (Webhooks).
    Eventos soportados:
    - delivery: El correo fue entregado exitosamente en el buzón destino.
    - open: El destinatario abrió el correo comercial.
    - click: El destinatario hizo clic en un enlace del correo (ej. demo_url WhatsApp).
    - bounce / soft_bounce / reject: Falla en la entrega.
    """
    raw_body = await request.body()
    signature_header = request.headers.get("Mailtrap-Signature") or request.headers.get("mailtrap-signature")

    if not verify_mailtrap_signature(raw_body, signature_header):
        logger.warning("[Mailtrap Webhook] Firma HMAC inválida.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Firma de webhook inválida")

    try:
        body = await request.json()
    except Exception:
        body = {}

    # Mailtrap puede enviar {"events": [...]} o una lista directa o un único objeto
    events_list: List[Dict[str, Any]] = []
    if isinstance(body, dict):
        if "events" in body and isinstance(body["events"], list):
            events_list = body["events"]
        else:
            events_list = [body]
    elif isinstance(body, list):
        events_list = body

    processed_count = 0
    now = datetime.utcnow()

    for event_data in events_list:
        event_type = event_data.get("event") or event_data.get("type")
        recipient_email = event_data.get("email")
        message_id = event_data.get("message_id")
        timestamp_raw = event_data.get("timestamp")

        event_time = now
        if timestamp_raw:
            try:
                event_time = datetime.utcfromtimestamp(float(timestamp_raw))
            except Exception:
                event_time = now

        if not recipient_email and not message_id:
            continue

        # Localizar el prospecto por message_id o por correo electrónico
        business = None
        if message_id:
            business = db.query(ProspectingBusiness).filter(
                ProspectingBusiness.email_message_id == str(message_id)
            ).first()

        if not business and recipient_email:
            business = db.query(ProspectingBusiness).filter(
                ProspectingBusiness.email.ilike(recipient_email.strip())
            ).order_by(ProspectingBusiness.id.desc()).first()

        if not business:
            logger.info(f"[Mailtrap Webhook] Prospecto no encontrado para {recipient_email} / {message_id}")
            continue

        # Actualizar estado de entrega y timestamps según el evento recibido
        if event_type == "delivery":
            business.email_delivery_status = "delivered"
            business.email_delivered_at = event_time
        elif event_type == "open":
            # Si se abre, actualizamos a 'opened' si antes era 'delivered' o 'sent'
            if business.email_delivery_status in ["none", "sent", "delivered"]:
                business.email_delivery_status = "opened"
            business.email_opened_at = event_time
        elif event_type == "click":
            business.email_delivery_status = "clicked"
            business.email_clicked_at = event_time
        elif event_type in ["bounce", "soft_bounce", "reject", "spam"]:
            business.email_delivery_status = "bounced"

        # Registrar la auditoría en la bitácora de fuentes
        db.add(ProspectingSource(
            business_id=business.id,
            source_type="email_event",
            source_url=f"mailtrap:{event_type}",
            confidence_level="confirmed",
            http_status=200,
            summary=f"Evento de Mailtrap recibido: '{event_type}' para {recipient_email} (MsgID: {message_id})",
            extracted_data=event_data,
            fetched_at=event_time
        ))

        processed_count += 1

    db.commit()

    return {
        "ok": True,
        "processed_events": processed_count
    }
