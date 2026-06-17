import logging
import httpx
from fastapi import APIRouter, Request, Query, HTTPException, status, Depends
from fastapi.responses import PlainTextResponse
from app.config import settings
from app.limiter import limiter
from app.lib.security import verify_whatsapp_signature

# Configurar logs usando el logger integrado de uvicorn
logger = logging.getLogger("uvicorn.error")


router = APIRouter(prefix="/api/webhooks/whatsapp", tags=["whatsapp"])

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
async def receive_webhook(request: Request):
    """
    Endpoint para recibir el payload de WhatsApp y reenviarlo a la API centralizada.
    """
    try:
        payload = await request.json()
        logger.info(f"Evento de WhatsApp recibido: {payload}")
        
        # Enviar el payload completo a la API interna
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.API_URL}/api/events",
                json=payload,
                timeout=10.0
            )
            
        if response.status_code != 200:
            logger.error(f"Fallo al reenviar evento a la API: HTTP {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Fallo al comunicar con la API central."
            )
            
        api_data = response.json()
        logger.info(f"Evento reenviado y guardado en API. ID retornado: {api_data.get('id')}")
        
        return {"status": "success", "message": "Event received and forwarded", "id": api_data.get("id")}
    except httpx.RequestError as exc:
        logger.error(f"Error de conexión con la API en {settings.API_URL}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Servicio de API central no disponible."
        )
    except Exception as e:
        logger.error(f"Error al procesar el evento recibido: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request payload or handling error"
        )


