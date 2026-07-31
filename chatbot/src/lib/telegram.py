import logging
from typing import Optional
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

    def send_message(self, chat_id: int or str, text: str, parse_mode: Optional[str] = "Markdown") -> dict:
        """Sends a text message to a specific Telegram chat.
        
        Args:
            chat_id: Unique identifier for the target chat or username.
            text: Text of the message to be sent.
            parse_mode: Parsing mode for formatting (e.g. 'Markdown', 'MarkdownV2', 'HTML'). Defaults to 'Markdown'.
        """
        if not self.token:
            logger.warning("TELEGRAM_BOT_TOKEN is not set. Skipping send_message.")
            return {"status": "skipped", "reason": "No token provided"}
            
        url = f"{self.base_url}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode
        
        try:
            with httpx.Client() as client:
                response = client.post(url, json=payload, timeout=10.0)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            if status_code in (400, 403):
                logger.warning(f"Telegram API client error: {status_code} - {e.response.text}")
            else:
                logger.error(f"Telegram API HTTP error: {status_code} - {e.response.text}")
            raise RuntimeError(f"Telegram API failed with status code {status_code}: {e.response.text}") from e
        except Exception as e:
            logger.error(f"Unexpected error sending message to Telegram: {str(e)}")
            raise e
