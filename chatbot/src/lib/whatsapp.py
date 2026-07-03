import os
import logging
import hmac
import hashlib
import httpx

logger = logging.getLogger(__name__)

class WhatsAppClient:
    def __init__(self, api_key: str = None, from_phone: str = None):
        """Initializes the YCloud WhatsApp Business API client.
        
        Args:
            api_key: The YCloud API key. If not provided, it will be loaded from
                     the YCLOUD_API_KEY environment variable.
            from_phone: The sender's phone number in E.164 format. If not provided,
                        it will be loaded from the YCLOUD_FROM_PHONE environment variable.
        """
        self.api_key = api_key or os.getenv("YCLOUD_API_KEY")
        self.from_phone = from_phone or os.getenv("YCLOUD_FROM_PHONE")
        self.base_url = "https://api.ycloud.com/v2/whatsapp/messages"

    def send_message(self, to_phone: str, text: str) -> dict:
        """Sends a text message to a specific WhatsApp number using YCloud.
        
        Args:
            to_phone: The recipient's phone number in E.164 format (e.g. +521234567890).
            text: Text of the message to be sent.
        """
        if not self.api_key:
            logger.warning("YCLOUD_API_KEY is not set. Skipping send_message.")
            return {"status": "skipped", "reason": "No API key provided"}
            
        if not self.from_phone:
            logger.warning("YCLOUD_FROM_PHONE is not set. Skipping send_message.")
            return {"status": "skipped", "reason": "No sender phone number provided"}

        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "from": self.from_phone,
            "to": to_phone,
            "type": "text",
            "text": {
                "body": text,
                "preview_url": True,
            }
        }

        try:
            with httpx.Client() as client:
                response = client.post(self.base_url, headers=headers, json=payload, timeout=10.0)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"YCloud API HTTP error: {e.response.status_code} - {e.response.text}")
            raise RuntimeError(f"YCloud API failed with status code {e.response.status_code}: {e.response.text}") from e
        except Exception as e:
            logger.error(f"Unexpected error sending message via YCloud: {str(e)}")
            raise e

    @staticmethod
    def verify_signature(request_body: str, signature_header: str, secret: str) -> bool:
        """Verifies the YCloud-Signature header to ensure requests are authentic.
        
        Args:
            request_body: The raw request body string.
            signature_header: The 'YCloud-Signature' header value.
            secret: The webhook signing secret.
        """
        if not signature_header or not secret:
            logger.error("Signature header or webhook secret is missing.")
            return False

        try:
            # Parse header: t=timestamp,s=signature
            parts = dict(item.split("=") for item in signature_header.split(","))
            timestamp = parts.get("t")
            received_signature = parts.get("s")

            if not timestamp or not received_signature:
                logger.error("Invalid YCloud-Signature header format.")
                return False

            # Construct the signed payload: timestamp.body
            signed_payload = f"{timestamp}.{request_body}"

            # Compute HMAC-SHA256 signature
            computed_signature = hmac.new(
                key=secret.encode("utf-8"),
                msg=signed_payload.encode("utf-8"),
                digestmod=hashlib.sha256
            ).hexdigest()

            # Constant-time comparison to protect against timing attacks
            return hmac.compare_digest(computed_signature, received_signature)

        except Exception as e:
            logger.error(f"YCloud signature verification error: {str(e)}")
            return False
