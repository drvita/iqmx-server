import logging
import httpx

logger = logging.getLogger(__name__)

class TelegramClient:
    def __init__(self, token: str):
        """Initializes the Telegram Bot API client.
        
        Args:
            token: The Telegram Bot API token (typically from BotFather).
        """
        self.token = token
        self.base_url = f"https://api.telegram.org/bot{token}"

    def send_message(self, chat_id: int or str, text: str) -> dict:
        """Sends a text message to a specific Telegram chat.
        
        Args:
            chat_id: Unique identifier for the target chat or username.
            text: Text of the message to be sent.
        """
        if not self.token:
            logger.warning("TELEGRAM_BOT_TOKEN is not set. Skipping send_message.")
            return {"status": "skipped", "reason": "No token provided"}
            
        url = f"{self.base_url}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text
        }
        
        try:
            with httpx.Client() as client:
                response = client.post(url, json=payload, timeout=10.0)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Telegram API HTTP error: {e.response.status_code} - {e.response.text}")
            raise RuntimeError(f"Telegram API failed with status code {e.response.status_code}: {e.response.text}") from e
        except Exception as e:
            logger.error(f"Unexpected error sending message to Telegram: {str(e)}")
            raise e
