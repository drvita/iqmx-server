import src.config
from fastapi import FastAPI
from src.endpoints.telegram import router as telegram_router
from src.endpoints.whatsapp import router as whatsapp_router

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

