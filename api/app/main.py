from fastapi import FastAPI
import sentry_sdk
import os
from app.config import settings
from app.db.database import engine
from app.models import Base
from app.api import events, chatbot

# Crear tablas si no existen ( SQLAlchemy usará Base.metadata que ya tiene registrados todos los modelos )
Base.metadata.create_all(bind=engine)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if ENVIRONMENT == "production":
    sentry_sdk.init(
        dsn="https://384bea36ce9fd0da0ea7271af0d53e83@o1332916.ingest.us.sentry.io/4511673327222784",
        send_default_pii=True,
    )

# Inicializar FastAPI
app = FastAPI(
    title="Central API Microservice",
    description="Servicio interno y privado para administración de base de datos, modelos y lógica central.",
    version="1.0.0"
)

# Registrar rutas
app.include_router(events.router)
app.include_router(chatbot.router)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "api",
        "environment": settings.ENVIRONMENT
    }

