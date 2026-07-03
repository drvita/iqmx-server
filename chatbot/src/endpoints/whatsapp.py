import os
import logging
from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from langchain_core.messages import HumanMessage, AIMessage

from src.agent.graph import graph
from src.lib.whatsapp import WhatsAppClient
from src.agent.utils.llm import parse_llm_response

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/whatsapp",
    tags=["whatsapp"]
)

# Initialize WhatsApp client
YCLOUD_API_KEY = os.getenv("YCLOUD_API_KEY", "")
YCLOUD_FROM_PHONE = os.getenv("YCLOUD_FROM_PHONE", "")
whatsapp_client = WhatsAppClient(api_key=YCLOUD_API_KEY, from_phone=YCLOUD_FROM_PHONE)

@router.post("")
async def whatsapp_webhook(request: Request):
    """Webhook endpoint to receive inbound messages from YCloud WhatsApp service.
    
    Verifies request signature, validates message parameters, and forwards
    the text message to the LangGraph agent before sending the response back.
    """
    # 1. Read raw body for signature verification
    try:
        body_bytes = await request.body()
        body_str = body_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"Error reading request body: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"status": "error", "message": "Failed to read request body"}
        )

    # 2. Get YCloud Signature header and verify
    signature_header = request.headers.get("YCloud-Signature", "")
    secret = os.getenv("YCLOUD_WEBHOOK_SECRET", "")
    
    # Only verify signature if a secret is configured (allowing optional skip for local testing)
    if secret and signature_header:
        if not WhatsAppClient.verify_signature(body_str, signature_header, secret):
            logger.warning("Invalid YCloud-Signature received.")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"status": "error", "message": "Invalid webhook signature"}
            )
    else:
        logger.warning("YCLOUD_WEBHOOK_SECRET is not configured. Signature verification skipped.")

    # 3. Parse JSON payload
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"status": "error", "message": "Invalid JSON payload"}
        )

    event_type = payload.get("type")
    if event_type != "whatsapp.inbound_message.received":
        return {
            "status": "ignored",
            "reason": f"Event type '{event_type}' is not supported"
        }

    inbound_msg = payload.get("whatsappInboundMessage")
    if not inbound_msg:
        return {
            "status": "ignored",
            "reason": "Missing whatsappInboundMessage object in payload"
        }

    # 4. Validate recipient (to_phone) matches our configured sender phone
    to_phone = inbound_msg.get("to")
    if not YCLOUD_FROM_PHONE:
        logger.warning("YCLOUD_FROM_PHONE is not configured. Proceeding without recipient validation.")
    elif to_phone != YCLOUD_FROM_PHONE:
        logger.warning(f"Inbound message recipient '{to_phone}' does not match YCLOUD_FROM_PHONE '{YCLOUD_FROM_PHONE}'")
        return {
            "status": "ignored",
            "reason": "Message is not addressed to this service configuration"
        }

    # 5. Filter message type (Only process text messages)
    msg_type = inbound_msg.get("type")
    if msg_type != "text":
        return {
            "status": "ignored",
            "reason": f"Message type '{msg_type}' is not supported (only 'text' is allowed)"
        }

    # 6. Extract message details
    text_content = inbound_msg.get("text", {}).get("body", "")
    sender_phone = inbound_msg.get("from")
    from_user_id = inbound_msg.get("fromUserId")

    # Use fromUserId as the primary session and user identifier. Fallback to sender_phone.
    user_identifier = from_user_id if from_user_id else sender_phone

    if not user_identifier or not text_content:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"status": "error", "message": "Missing sender identifier or text body"}
        )

    # 7. Configure LangGraph thread and state
    config = {
        "configurable": {
            "thread_id": f"whatsapp_{user_identifier}"
        }
    }

    state = {
        "messages": [HumanMessage(content=text_content)],
        "user_id": str(user_identifier),
        "platform": "whatsapp",
        "bot_id": str(to_phone) if to_phone else YCLOUD_FROM_PHONE,
        "user_phone": str(sender_phone) if sender_phone else None
    }

    # 8. Run agent and send response
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

        # Extract and validate clean response text
        clean_response = parse_llm_response(last_msg.content)
        
        # Send reply back via YCloud WhatsApp Client
        try:
            whatsapp_client.send_message(to_phone=sender_phone, text=clean_response)
        except Exception as api_err:
            logger.error(f"Failed to send response message via YCloud WhatsApp: {str(api_err)}")
            
        return {
            "status": "success",
            "recipient": sender_phone,
            # "response": clean_response
        }
    except Exception as e:
        logger.error(f"Agent processing failed for WhatsApp request: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": f"Agent processing failed: {str(e)}"}
        )
