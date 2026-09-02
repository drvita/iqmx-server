import unittest
import urllib.parse
import json
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.db.database import SessionLocal
from app.models import User, Customer, CustomerWebhook, WhatsAppNumber, Event
from app.lib.crypto import encrypt_token, calculate_hmac_sha256

class TestWebhooks(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        
        # Crear cliente y número de prueba para las aserciones
        db = SessionLocal()
        email = "webhook_test_client@iqmx.com"
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(name="Cliente Webhook Test", email=email, password_hash="hash")
            db.add(user)
            db.commit()
            db.refresh(user)
        
        customer = db.query(Customer).filter(Customer.user_id == user.id).first()
        if not customer:
            customer = Customer(
                user_id=user.id,
                company_name="Cliente Webhook Test",
                contact_name="Tester",
                origin="web_signup",
                privacy_accepted_at=db.query(User).first().created_at if hasattr(db.query(User).first(), 'created_at') else None
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)

        cls.customer_id = customer.id

        # Configuración de webhook
        webhook = db.query(CustomerWebhook).filter(CustomerWebhook.customer_id == customer.id).first()
        if not webhook:
            webhook = CustomerWebhook(
                customer_id=customer.id,
                url=None,
                secret_token="secret_webhook_test_key_123",
                is_active=True
            )
            db.add(webhook)
            db.commit()
        cls.webhook = webhook

        # Crear número de WhatsApp asociado
        pn_id = "888877776666"
        num = db.query(WhatsAppNumber).filter(WhatsAppNumber.phone_number_id == pn_id).first()
        if not num:
            num = WhatsAppNumber(
                customer_id=customer.id,
                phone_number_id=pn_id,
                waba_id="waba_888",
                display_phone_number="+52 314 000 0000",
                verified_name="Cuenta Verificada",
                encrypted_token=encrypt_token("token", settings.TOKEN_ENCRYPTION_KEY),
                status="connected"
            )
            db.add(num)
            db.commit()
        cls.phone_number_id = pn_id
        db.close()

    def _post_signed_webhook(self, payload: dict):
        raw_body = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        headers = {"Content-Type": "application/json"}
        if settings.META_APP_SECRET:
            sig = calculate_hmac_sha256(settings.META_APP_SECRET, raw_body)
            headers["X-Hub-Signature-256"] = f"sha256={sig}"
        return self.client.post("/api/webhooks/whatsapp", content=raw_body, headers=headers)

    def test_meta_get_handshake(self):
        challenge = "1234567890_challenge"
        token_encoded = urllib.parse.quote_plus(settings.WHATSAPP_VERIFY_TOKEN)
        res = self.client.get(
            f"/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge={challenge}&hub.verify_token={token_encoded}"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.text, challenge)

    def test_meta_get_handshake_wrong_token(self):
        res = self.client.get(
            "/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=123&hub.verify_token=wrong_token"
        )
        self.assertEqual(res.status_code, 403)

    def test_webhook_unregistered_number_saved_for_debugging(self):
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "1",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "000000000000"},
                        "messages": [{"id": "m1", "text": {"body": "Mensaje de número no registrado"}}]
                    },
                    "field": "messages"
                }]
            }]
        }
        res = self._post_signed_webhook(payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("id", data)

        # Verificar que quedó en la base de datos para debugging
        db = SessionLocal()
        event = db.query(Event).filter(Event.id == data["id"]).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.delivery_status, "pending")
        db.close()

    def test_webhook_registered_number_without_url_marked_as_sent(self):
        # Asegurar que el webhook no tiene URL
        db = SessionLocal()
        wh = db.query(CustomerWebhook).filter(CustomerWebhook.customer_id == self.customer_id).first()
        wh.url = None
        db.commit()
        db.close()

        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "1",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": self.phone_number_id},
                        "messages": [{"id": "m2", "text": {"body": "Cliente sin URL configurada"}}]
                    },
                    "field": "messages"
                }]
            }]
        }
        res = self._post_signed_webhook(payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["delivery_status"], "sent")

        # Verificar en BD que delivery_status sea 'sent'
        db = SessionLocal()
        event = db.query(Event).filter(Event.id == data["id"]).first()
        self.assertEqual(event.delivery_status, "sent")
        db.close()

if __name__ == "__main__":
    unittest.main()
