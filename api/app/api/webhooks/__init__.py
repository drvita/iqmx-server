from app.api.webhooks.whatsapp import router as whatsapp_router, legacy_router as whatsapp_legacy_router
from app.api.webhooks.mercadopago import router as mercadopago_router, legacy_router as mercadopago_legacy_router

__all__ = ["whatsapp_router", "whatsapp_legacy_router", "mercadopago_router", "mercadopago_legacy_router"]
