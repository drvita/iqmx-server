import hmac
import hashlib
import logging
from fastapi import Request, Header, HTTPException, status
from app.config import settings

logger = logging.getLogger("uvicorn.error")

async def verify_whatsapp_signature(request: Request, x_hub_signature_256: str = Header(None)):
    """
    Dependency para verificar que las peticiones POST provienen genuinamente de Meta.
    Usa la firma X-Hub-Signature-256 calculada con HMAC-SHA256 usando el META_APP_SECRET.
    """
    # Si no está configurada la llave secreta (ej. en desarrollo local), omitir validación.
    if not settings.META_APP_SECRET:
        logger.warning("META_APP_SECRET no está configurada. Omitiendo validación de firma (Solo permitido en desarrollo).")
        return

    if not x_hub_signature_256:
        logger.error("Falta la cabecera X-Hub-Signature-256 en la petición del Webhook.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta la cabecera X-Hub-Signature-256."
        )

    if not x_hub_signature_256.startswith("sha256="):
        logger.error("Firma inválida: No inicia con el formato 'sha256='.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de firma inválido."
        )

    # Extraer la firma criptográfica (quitar el prefijo 'sha256=')
    received_signature = x_hub_signature_256[7:]

    # Leer el cuerpo en bruto (bytes) de la petición
    body_bytes = await request.body()

    # Calcular la firma esperada usando el App Secret y el cuerpo
    expected_signature = hmac.new(
        settings.META_APP_SECRET.encode("utf-8"),
        body_bytes,
        hashlib.sha256
    ).hexdigest()

    # Comparar de forma segura para prevenir ataques de temporización (timing attacks)
    if not hmac.compare_digest(expected_signature, received_signature):
        logger.error("Fallo de autenticidad: La firma provista no coincide con la firma esperada.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firma digital no válida. Evento rechazado."
        )

    logger.info("Firma digital de Meta validada correctamente.")
