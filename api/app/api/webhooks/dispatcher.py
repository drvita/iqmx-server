import asyncio
import json
import logging
import httpx
from datetime import datetime
from app.db.database import SessionLocal
from app.models.event import Event
from app.models.customer_webhook import CustomerWebhook
from app.lib.crypto import calculate_hmac_sha256

logger = logging.getLogger("uvicorn.error")

# Intervalos de reintento en segundos: 15s, 30s, 60s
RETRY_DELAYS = [15, 30, 60]

async def dispatch_webhook_with_retries(
    event_id: int,
    webhook_url: str,
    secret_token: str,
    payload: dict,
    customer_id: int
):
    """
    Despacha asíncronamente el payload de WhatsApp al CRM externo del cliente.
    Aplica firma HMAC-SHA256 (X-Signature: sha256=...) y una política estricta de 3 reintentos
    en lapsos de 15, 30 y 60 segundos si el servidor del cliente responde con error 4xx/5xx o timeout.
    """
    payload_json = json.dumps(payload, separators=(',', ':'))
    payload_bytes = payload_json.encode("utf-8")
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "IQMX-WhatsApp-Gateway/1.0",
        "X-IQMX-Event-ID": str(event_id)
    }

    if secret_token and secret_token.strip():
        signature = calculate_hmac_sha256(secret_token.strip(), payload_bytes)
        headers["X-Signature"] = f"sha256={signature}"

    max_attempts = len(RETRY_DELAYS) + 1  # Intento 0 + 3 reintentos = 4 intentos en total
    attempt = 0
    success = False
    last_error_msg = None
    last_status_code = None

    async with httpx.AsyncClient(timeout=10.0) as client:
        while attempt < max_attempts:
            attempt += 1
            logger.info(f"Despachando evento #{event_id} a '{webhook_url}' (Intento {attempt}/{max_attempts})...")
            
            try:
                response = await client.post(webhook_url, content=payload_bytes, headers=headers)
                last_status_code = response.status_code
                
                # Consideramos exitoso únicamente códigos 2xx (200 OK, 201, 204)
                if 200 <= response.status_code < 300:
                    logger.info(f"Evento #{event_id} entregado exitosamente al cliente. HTTP {response.status_code}")
                    success = True
                    break
                else:
                    last_error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                    logger.warning(
                        f"Fallo en entrega de evento #{event_id} (Intento {attempt}/{max_attempts}): {last_error_msg}"
                    )
            except httpx.RequestError as exc:
                last_status_code = None
                last_error_msg = f"Error de conexión/timeout: {str(exc)}"
                logger.warning(
                    f"Excepción de red al despachar evento #{event_id} (Intento {attempt}/{max_attempts}): {last_error_msg}"
                )
            except Exception as e:
                last_status_code = None
                last_error_msg = f"Error inesperado: {str(e)}"
                logger.error(f"Error crítico en despacho de evento #{event_id}: {last_error_msg}")

            # Si no tuvo éxito y quedan reintentos, esperar el lapso configurado (15s, 30s, 60s)
            if not success and attempt < max_attempts:
                delay = RETRY_DELAYS[attempt - 1]
                logger.info(f"Esperando {delay} segundos antes del reintento {attempt + 1} para evento #{event_id}...")
                await asyncio.sleep(delay)

    # Actualizar estado final en la base de datos
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if event:
            event.delivery_attempts = attempt
            event.delivery_status = "delivered" if success else "failed"
            event.last_delivery_error = None if success else last_error_msg
            db.commit()

        webhook = db.query(CustomerWebhook).filter(CustomerWebhook.customer_id == customer_id).first()
        if webhook:
            webhook.last_delivery_status = "delivered" if success else "failed"
            webhook.last_delivery_code = last_status_code
            webhook.last_delivery_at = datetime.utcnow()
            db.commit()
    except Exception as db_err:
        logger.error(f"Error al actualizar estado de despacho para evento #{event_id} en BD: {db_err}")
    finally:
        db.close()
