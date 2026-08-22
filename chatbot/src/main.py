from fastapi import FastAPI
from src.endpoints.telegram import router as telegram_router
from src.endpoints.whatsapp import router as whatsapp_router
import os
import logging
import sentry_sdk

# Configure standard logging to output to stdout/stderr
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if ENVIRONMENT == "production":
    sentry_sdk.init(
        dsn="https://7f43e167184ede558a3665de76325955@o1332916.ingest.us.sentry.io/4511673252642816",
        send_default_pii=True,
    )

app = FastAPI(
    title="IQISSMexico Channel Webhooks API",
    description="Central webhook dispatcher service for multiple messaging channels (Telegram, WhatsApp, etc.) integrating with the Octavio Agent from IQISSMexico."
)

# Mount webhook routers
app.include_router(telegram_router, prefix="/api/webhooks")
app.include_router(whatsapp_router, prefix="/api/webhooks")

@app.get("/")
def read_root():
    return {"message": "IQISSMexico Webhook service is running."}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "chatbot"}