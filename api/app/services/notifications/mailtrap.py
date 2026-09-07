import logging
from typing import Optional, Dict, Any, List
import httpx

from app.config import settings

logger = logging.getLogger("uvicorn.error")

DEFAULT_MAILTRAP_SEND_URL = "https://send.api.mailtrap.io/api/send"


def resolve_mailtrap_url(custom_url: Optional[str] = None) -> str:
    """
    Resuelve la URL del endpoint de envío de Mailtrap.
    Si se proporciona un endpoint completo (ej. sandbox con inbox ID o producción),
    se respeta íntegramente. Si solo se especifica el dominio base, añade '/api/send'.
    Por defecto utiliza settings.MAILTRAP_API_URL o la URL de producción.
    """
    raw_url = (custom_url or settings.MAILTRAP_API_URL or DEFAULT_MAILTRAP_SEND_URL).strip()
    if "/send" not in raw_url:
        raw_url = raw_url.rstrip("/") + "/api/send"
    return raw_url


def send_mailtrap_template(
    to_email: str,
    template_uuid: str,
    template_variables: Dict[str, Any],
    from_email: Optional[str] = None,
    from_name: Optional[str] = None,
    to_name: Optional[str] = None,
    api_token: Optional[str] = None,
    api_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Envía un correo transaccional utilizando Mailtrap Send API con plantillas predefinidas.
    
    :param to_email: Correo electrónico del destinatario.
    :param template_uuid: UUID de la plantilla registrada en Mailtrap.
    :param template_variables: Diccionario clave-valor con las variables dinámicas requeridas por la plantilla.
    :param from_email: Correo del remitente. Si es None, utiliza settings.MAIL_FROM_EMAIL por defecto.
    :param from_name: Nombre o departamento del remitente. Si es None, utiliza settings.MAIL_FROM_NAME por defecto.
    :param to_name: Nombre opcional del destinatario.
    :param api_token: Token de la API de Mailtrap opcional; por defecto toma settings.MAILTRAP_API_TOKEN.
    :return: Diccionario con el resultado de la operación.
    """
    token = api_token or settings.MAILTRAP_API_TOKEN
    if not token or not str(token).strip():
        logger.info("[Mailtrap] MAILTRAP_API_TOKEN no está configurado. Omitiendo envío de correo.")
        return {"success": False, "reason": "no_token_configured"}

    clean_to_email = to_email.strip().lower()
    if not clean_to_email:
        return {"success": False, "reason": "empty_recipient_email"}

    # Resuelve remitente (permite sobreescritura por departamento o valor por defecto)
    resolved_from_email = (from_email or settings.MAIL_FROM_EMAIL).strip()
    resolved_from_name = (from_name or settings.MAIL_FROM_NAME).strip()

    recipient_payload: Dict[str, str] = {"email": clean_to_email}
    if to_name and to_name.strip():
        recipient_payload["name"] = to_name.strip()

    payload = {
        "from": {
            "email": resolved_from_email,
            "name": resolved_from_name,
        },
        "to": [recipient_payload],
        "template_uuid": template_uuid.strip(),
        "template_variables": template_variables or {},
    }

    headers = {
        "Authorization": f"Bearer {token.strip()}",
        "Content-Type": "application/json",
    }

    target_url = resolve_mailtrap_url(api_url)

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(target_url, json=payload, headers=headers)
            if response.status_code in [200, 201, 202]:
                data = response.json() if response.text else {}
                logger.info(
                    f"[Mailtrap] Correo enviado exitosamente a {clean_to_email} "
                    f"con plantilla {template_uuid} (endpoint: {target_url}) "
                    f"desde {resolved_from_name} <{resolved_from_email}>."
                )
                return {"success": True, "to": clean_to_email, "data": data}
            else:
                logger.error(
                    f"[Mailtrap] Error al enviar correo a {clean_to_email}. "
                    f"HTTP {response.status_code}: {response.text}"
                )
                return {
                    "success": False,
                    "to": clean_to_email,
                    "status_code": response.status_code,
                    "error": response.text,
                }
    except Exception as e:
        logger.error(f"[Mailtrap] Excepción al enviar correo a {clean_to_email}: {e}")
        return {"success": False, "to": clean_to_email, "error": str(e)}
