from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
import sentry_sdk
import os

from app.config import settings
from app.limiter import limiter
from app.api import events, portal_auth, portal_whatsapp, portal_webhook, public_catalog, portal_subscriptions, portal_crm, internal_products
from app.api import admin_auth, admin_users, admin_customers, admin_catalog, admin_crm, admin_subscriptions, admin_security
from app.api.webhooks import whatsapp_router, whatsapp_legacy_router, mercadopago

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if ENVIRONMENT == "production":
    sentry_sdk.init(
        dsn="https://384bea36ce9fd0da0ea7271af0d53e83@o1332916.ingest.us.sentry.io/4511673327222784",
        send_default_pii=True,
    )

# Inicializar FastAPI
app = FastAPI(
    title="IQMX Central API & Gateway",
    description="Servicio central para administración de base de datos, onboarding de WhatsApp y Gateway de Webhooks.",
    version="1.0.0"
)

# Configurar Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configurar CORS para permitir comunicación desde el frontend (incluyendo ngrok)
cors_kwargs = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.ENVIRONMENT != "production":
    cors_kwargs["allow_origin_regex"] = r"^https?://.*"
else:
    cors_kwargs["allow_origins"] = ["https://iqissmexico.com", "https://crm.iqissmexico.com"]

app.add_middleware(CORSMiddleware, **cors_kwargs)

# Registrar rutas de Webhook Gateway
app.include_router(whatsapp_router)
app.include_router(whatsapp_legacy_router)
app.include_router(mercadopago.router)

# Registrar rutas del Portal de Clientes
app.include_router(portal_auth.router)
app.include_router(portal_whatsapp.router)
app.include_router(portal_webhook.router)
app.include_router(portal_subscriptions.router)
app.include_router(portal_crm.router)
app.include_router(public_catalog.router)

# Registrar rutas del Portal Administrativo (Admin)
app.include_router(admin_auth.router)
app.include_router(admin_users.router)
app.include_router(admin_customers.router)
app.include_router(admin_catalog.router)
app.include_router(admin_crm.router)
app.include_router(admin_subscriptions.router)
app.include_router(admin_security.router)

# Registrar rutas heredadas / internas
app.include_router(events.router)
app.include_router(internal_products.router)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "api",
        "environment": settings.ENVIRONMENT
    }

