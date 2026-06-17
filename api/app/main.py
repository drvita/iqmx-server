from fastapi import FastAPI
from app.config import settings
from app.db.database import engine
from app.models import Base
from app.db.seeds import seed_database
from app.api import events

# Crear tablas si no existen ( SQLAlchemy usará Base.metadata que ya tiene registrados todos los modelos )
Base.metadata.create_all(bind=engine)

# Ejecutar semillas condicionales
seed_database()

# Inicializar FastAPI
app = FastAPI(
    title="Central API Microservice",
    description="Servicio interno y privado para administración de base de datos, modelos y lógica central.",
    version="1.0.0"
)

# Registrar rutas
app.include_router(events.router)

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "api",
        "environment": settings.ENVIRONMENT
    }

