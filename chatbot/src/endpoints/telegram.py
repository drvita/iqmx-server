import os
import logging
import random
from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from langchain_core.messages import HumanMessage, AIMessage

from src.agent.admin_graph import admin_graph
from src.lib.telegram import TelegramClient
from src.agent.utils.llm import parse_llm_response

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/telegram",
    tags=["telegram"]
)

# Fetch Telegram Bot Token from environment variables
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
telegram_client = TelegramClient(token=TELEGRAM_BOT_TOKEN)

# Load allowed Telegram IDs from environment
ADMIN_TELEGRAM_IDS = [
    id_str.strip()
    for id_str in os.getenv("ADMIN_TELEGRAM_IDS", "").split(",")
    if id_str.strip()
]

# Load Telegram Webhook Secret from environment
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")

# List of 10 rejection messages in Spanish
REJECTION_MESSAGES = [
    "Lo sentimos, este bot no está disponible para su usuario.",
    "Acceso denegado. Este asistente inteligente es de uso restringido.",
    "El bot de Telegram solicitado no se encuentra activo o disponible.",
    "Disculpe, no cuenta con los permisos necesarios para interactuar con este bot.",
    "Lo sentimos, este canal de comunicación está desactivado temporalmente para el público general.",
    "Esta cuenta de Telegram no está autorizada para acceder a este bot administrativo.",
    "El asistente no está disponible o su cuenta no está en la lista de permitidos.",
    "Acceso no autorizado. Este bot está restringido únicamente a personal interno.",
    "No se puede establecer la conexión. Este bot no está disponible para su perfil.",
    "Lo sentimos, el bot administrativo de IQISSMexico no está disponible."
]

@router.post("")
async def telegram_webhook(request: Request):
    """Webhook endpoint to receive text messages from Telegram.
    
    Validates request authenticity using a secret token if configured.
    Validates if the user is in the authorized admin list. If not, sends a random rejection message.
    If authorized, processes the message with the LangGraph admin agent.
    """
    # 1. Validate Telegram Secret Token if configured
    if TELEGRAM_WEBHOOK_SECRET:
        token_header = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if token_header != TELEGRAM_WEBHOOK_SECRET:
            logger.warning("Invalid Telegram Secret Token received.")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"status": "error", "message": "Invalid webhook secret token"}
            )

    try:
        payload = await request.json()
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"status": "error", "message": "Invalid JSON payload"}
        )
        
    message = payload.get("message")
    if not message:
        return {"status": "ignored", "reason": "No message object found in update"}
        
    text = message.get("text")
    if not text:
        return {"status": "ignored", "reason": "Message does not contain text content"}
        
    chat = message.get("chat", {})
    chat_id = chat.get("id")
    sender = message.get("from", {})
    user_id = sender.get("id")
    
    if chat_id is None:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"status": "error", "message": "Missing chat.id in message"}
        )
        
    # Check authorization first before invoking any LLM/agent logic
    is_allowed = False
    if user_id is not None:
        is_allowed = str(user_id) in ADMIN_TELEGRAM_IDS
        
    if not is_allowed:
        rejection_text = f"{random.choice(REJECTION_MESSAGES)} [{user_id}]"
        try:
            telegram_client.send_message(chat_id=chat_id, text=rejection_text)
        except Exception as api_err:
            logger.error(f"Failed to send rejection message to Telegram: {str(api_err)}")
        return {
            "status": "ignored",
            "reason": "User not in allowed admin Telegram list",
            "chat_id": chat_id
        }
        
    # Build LangGraph thread configuration for the admin agent
    config = {
        "configurable": {
            "thread_id": f"telegram_admin_{chat_id}"
        }
    }
        
    # Initialize state
    state = {
        "messages": [HumanMessage(content=text)],
        "user_id": str(user_id)
    }
    
    try:
        # Run admin agent workflow synchronously
        result = admin_graph.invoke(state, config=config)
        
        last_msg = result["messages"][-1]
        if not isinstance(last_msg, AIMessage):
            logger.info("Last message is not an AIMessage. Webhook exiting without response.")
            return {
                "status": "ignored",
                "reason": "AI responses disabled"
            }

        # Extract and validate the clean text message
        clean_response = parse_llm_response(last_msg.content)
        
        # Send reply back to Telegram
        try:
            telegram_client.send_message(chat_id=chat_id, text=clean_response)
        except Exception as api_err:
            logger.error(f"Failed to send message to Telegram API: {str(api_err)}")
            
        return {
            "status": "success",
            "chat_id": chat_id,
            # "response": clean_response
        }
    except Exception as e:
        logger.error(f"Admin agent processing failed: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": f"Admin agent processing failed: {str(e)}"}
        )
