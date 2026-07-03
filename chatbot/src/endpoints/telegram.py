import os
import logging
from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from langchain_core.messages import HumanMessage, AIMessage

from src.agent.graph import graph
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

@router.post("")
async def telegram_webhook(request: Request):
    """Webhook endpoint to receive text messages from Telegram.
    
    Processes the message with the LangGraph agent and sends back the reply.
    """
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
        
    # Build LangGraph thread configuration
    config = {
        "configurable": {
            "thread_id": f"telegram_{chat_id}"
        }
    }
    
    bot_id = TELEGRAM_BOT_TOKEN.split(":")[0] if TELEGRAM_BOT_TOKEN else "default_telegram_bot"
    
    # Initialize state
    state = {
        "messages": [HumanMessage(content=text)],
        "user_id": str(user_id) if user_id is not None else None,
        "platform": "telegram",
        "bot_id": bot_id
    }

    
    try:
        # Run agent workflow synchronously
        result = graph.invoke(state, config=config)
        
        last_msg = result["messages"][-1]
        if not isinstance(last_msg, AIMessage):
            logger.info("Last message is not an AIMessage (AI responses disabled). Webhook exiting without response.")
            return {
                "status": "ignored",
                "reason": "AI responses disabled (human requested)"
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
            "response": clean_response
        }
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": f"Agent processing failed: {str(e)}"}
        )
