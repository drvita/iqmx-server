import logging
from typing import Optional, Dict, Any
import httpx

from app.config import settings

logger = logging.getLogger("uvicorn.error")


def send_telegram_message(
    chat_id: str | int,
    text: str,
    parse_mode: str = "Markdown",
    bot_token: Optional[str] = None
) -> Dict[str, Any]:
    """
    Envía un mensaje a un chat o canal de Telegram a través de la Bot API oficial.
    
    :param chat_id: ID numérico o username del chat de Telegram.
    :param text: Contenido del mensaje (soporta Markdown o HTML).
    :param parse_mode: Modo de formato ('Markdown' o 'HTML').
    :param bot_token: Token opcional del bot; por defecto toma settings.TELEGRAM_BOT_TOKEN.
    :return: Diccionario con el resultado de la operación.
    """
    token = bot_token or settings.TELEGRAM_BOT_TOKEN
    if not token or not str(token).strip():
        logger.info("[Telegram] TELEGRAM_BOT_TOKEN no está configurado. Omitiendo envío.")
        return {"success": False, "reason": "no_token_configured"}

    clean_chat_id = str(chat_id).strip()
    if not clean_chat_id:
        return {"success": False, "reason": "empty_chat_id"}

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": clean_chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(url, json=payload)
            if response.status_code == 200:
                logger.info(f"[Telegram] Mensaje enviado exitosamente a chat_id={clean_chat_id}.")
                return {"success": True, "chat_id": clean_chat_id, "data": response.json()}
            else:
                logger.error(
                    f"[Telegram] Error al enviar a chat_id={clean_chat_id}. "
                    f"HTTP {response.status_code}: {response.text}"
                )
                return {
                    "success": False,
                    "chat_id": clean_chat_id,
                    "status_code": response.status_code,
                    "error": response.text,
                }
    except Exception as e:
        logger.error(f"[Telegram] Excepción de conexión al enviar a chat_id={clean_chat_id}: {e}")
        return {"success": False, "chat_id": clean_chat_id, "error": str(e)}
