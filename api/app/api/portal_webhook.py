import time
import json
import logging
import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.models.customer import Customer
from app.models.customer_webhook import CustomerWebhook
from app.lib.security import get_current_customer
from app.lib.crypto import calculate_hmac_sha256, generate_secure_secret
from app.lib.ssrf_validator import validate_webhook_url

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/portal/webhook", tags=["portal-webhook"])

# --- Schemas ---

class WebhookConfigResponse(BaseModel):
    url: Optional[str]
    secret_token: Optional[str] = ""
    is_active: bool
    last_delivery_status: Optional[str]
    last_delivery_code: Optional[int]
    last_delivery_at: Optional[datetime]

class WebhookConfigUpdateRequest(BaseModel):
    url: Optional[str] = None
    secret_token: Optional[str] = None
    is_active: bool = True

class WebhookPingResponse(BaseModel):
    success: bool
    status_code: Optional[int]
    latency_ms: float
    message: str

# --- Endpoints ---

@router.get("/config", response_model=WebhookConfigResponse)
async def get_webhook_config(
    current_customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Obtiene la configuración de webhook de destino del cliente autenticado.
    """
    webhook = db.query(CustomerWebhook).filter(
        CustomerWebhook.customer_id == current_customer.id
    ).first()

    if not webhook:
        webhook = CustomerWebhook(
            customer_id=current_customer.id,
            url=None,
            secret_token=generate_secure_secret(32),
            is_active=True
        )
        db.add(webhook)
        db.commit()
        db.refresh(webhook)

    return WebhookConfigResponse(
        url=webhook.url,
        secret_token=webhook.secret_token,
        is_active=webhook.is_active,
        last_delivery_status=webhook.last_delivery_status,
        last_delivery_code=webhook.last_delivery_code,
        last_delivery_at=webhook.last_delivery_at
    )

@router.post("/config", response_model=WebhookConfigResponse)
async def update_webhook_config(
    req: WebhookConfigUpdateRequest,
    current_customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Actualiza la URL del webhook y el estado de activación del cliente.
    Aplica validación estricta anti-SSRF para garantizar que la URL no apunte a direcciones internas.
    """
    webhook = db.query(CustomerWebhook).filter(
        CustomerWebhook.customer_id == current_customer.id
    ).first()

    if not webhook:
        webhook = CustomerWebhook(
            customer_id=current_customer.id,
            secret_token=generate_secure_secret(32)
        )
        db.add(webhook)

    clean_url = req.url.strip() if req.url else None

    if clean_url:
        # Validar rigurosamente con anti-SSRF
        is_valid, error_msg = validate_webhook_url(clean_url)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"URL de webhook no válida: {error_msg}"
            )
        webhook.url = clean_url
    else:
        webhook.url = None

    if req.secret_token is not None:
        webhook.secret_token = req.secret_token.strip()

    webhook.is_active = req.is_active
    webhook.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(webhook)

    logger.info(f"Webhook actualizado para cliente #{current_customer.id}: URL={webhook.url}, Activo={webhook.is_active}")

    return WebhookConfigResponse(
        url=webhook.url,
        secret_token=webhook.secret_token,
        is_active=webhook.is_active,
        last_delivery_status=webhook.last_delivery_status,
        last_delivery_code=webhook.last_delivery_code,
        last_delivery_at=webhook.last_delivery_at
    )

@router.post("/regenerate-secret", response_model=WebhookConfigResponse)
async def regenerate_webhook_secret(
    current_customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Regenera una nueva clave secreta para la firma HMAC de los eventos del cliente.
    """
    webhook = db.query(CustomerWebhook).filter(
        CustomerWebhook.customer_id == current_customer.id
    ).first()

    if not webhook:
        webhook = CustomerWebhook(
            customer_id=current_customer.id,
            url=None,
            is_active=True
        )
        db.add(webhook)

    webhook.secret_token = generate_secure_secret(32)
    webhook.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(webhook)

    logger.info(f"Signing Secret regenerado para cliente #{current_customer.id}")

    return WebhookConfigResponse(
        url=webhook.url,
        secret_token=webhook.secret_token,
        is_active=webhook.is_active,
        last_delivery_status=webhook.last_delivery_status,
        last_delivery_code=webhook.last_delivery_code,
        last_delivery_at=webhook.last_delivery_at
    )

@router.post("/test-ping", response_model=WebhookPingResponse)
async def test_webhook_ping(
    current_customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Comprueba la conectividad y validez de la URL del webhook del CRM realizando un
    Handshake de verificación con método GET (estilo Meta) conforme al estándar de endpoints.md:
    1. Envía GET con hub.mode=subscribe, hub.challenge=<cadena_aleatoria> y hub.verify_token=<clave>.
    2. Envía cabecera Authorization: Bearer <clave> si se configuró una clave secreta.
    3. Si el servidor destino requiere POST como fallback, lo prueba automáticamente.
    """
    webhook = db.query(CustomerWebhook).filter(
        CustomerWebhook.customer_id == current_customer.id
    ).first()

    if not webhook or not webhook.url or not webhook.url.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tiene configurada una URL de webhook destino para realizar la prueba."
        )

    # Validar anti-SSRF
    is_valid, error_msg = validate_webhook_url(webhook.url)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La URL configurada no es segura: {error_msg}"
        )

    clean_url = webhook.url.strip()
    secret = webhook.secret_token.strip() if webhook.secret_token else ""
    challenge = f"iqmx_challenge_{generate_secure_secret(12)}"

    params = {
        "hub.mode": "subscribe",
        "hub.challenge": challenge,
    }
    if secret:
        params["hub.verify_token"] = secret

    headers = {
        "User-Agent": "IQMX-WhatsApp-Gateway-Tester/1.0",
        "Accept": "text/plain, application/json, */*",
    }
    if secret:
        headers["Authorization"] = f"Bearer {secret}"

    start_time = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            # 1. Intentar Handshake GET estándar (estilo Meta documentado en endpoints.md)
            response = await client.get(clean_url, params=params, headers=headers)
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # Si el servidor responde 405 (Method Not Allowed), intentar POST fallback
            if response.status_code == 405:
                test_payload = {
                    "event": "ping",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "message": "IQMX WhatsApp Gateway: Prueba de conectividad de Webhook",
                    "customer_id": current_customer.id,
                    "company_name": current_customer.company_name
                }
                payload_bytes = json.dumps(test_payload, separators=(',', ':')).encode("utf-8")
                post_headers = {
                    "Content-Type": "application/json",
                    "User-Agent": "IQMX-WhatsApp-Gateway-Tester/1.0",
                    "X-IQMX-Test-Ping": "true"
                }
                if secret:
                    post_headers["Authorization"] = f"Bearer {secret}"
                    sig = calculate_hmac_sha256(secret, payload_bytes)
                    post_headers["X-Signature"] = f"sha256={sig}"
                response = await client.post(clean_url, content=payload_bytes, headers=post_headers)
                elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            is_success = (200 <= response.status_code < 300)

            # Mensajes orientados al usuario según la respuesta del CRM
            if is_success:
                resp_text = response.text.strip()
                if challenge in resp_text:
                    msg = "El webhook del CRM verificó exitosamente el handshake y devolvió el challenge esperado."
                else:
                    msg = "El CRM respondió satisfactoriamente (HTTP 200 OK)."
            elif response.status_code == 404:
                msg = "No se encontró el webhook en el CRM (HTTP 404). Verifica que la ruta o el token de la URL sean correctos."
            elif response.status_code == 403:
                msg = "El CRM rechazó la verificación (HTTP 403 Forbidden). Verifica que la clave secreta o token coincidan."
            elif response.status_code == 401:
                msg = "El CRM requiere autenticación (HTTP 401 Unauthorized). Ingresa la clave de integración en el campo secreto."
            else:
                msg = f"El CRM respondió con código HTTP {response.status_code}."

            # Guardar último estado
            webhook.last_delivery_status = "delivered" if is_success else "failed"
            webhook.last_delivery_code = response.status_code
            webhook.last_delivery_at = datetime.utcnow()
            db.commit()

            return WebhookPingResponse(
                success=is_success,
                status_code=response.status_code,
                latency_ms=elapsed_ms,
                message=msg
            )
    except httpx.RequestError as exc:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        webhook.last_delivery_status = "failed"
        webhook.last_delivery_code = None
        webhook.last_delivery_at = datetime.utcnow()
        db.commit()
        return WebhookPingResponse(
            success=False,
            status_code=None,
            latency_ms=elapsed_ms,
            message=f"No se pudo contactar al servidor: {exc}"
        )
