from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.limiter import limiter
from app.api import whatsapp

# Inicializar FastAPI


app = FastAPI(
    title="Webhook Microservice",
    description="Microservicio dedicado a la recepción y validación de webhooks y notificaciones externas.",
    version="1.0.0"
)

# Configurar el Rate Limiter (slowapi) en el estado de la aplicación
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configuración de CORS dinámica
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar rutas
app.include_router(whatsapp.router)

@app.get("/health")
@limiter.limit(f"{settings.RATE_LIMIT_PER_SECOND}/second")
async def health_check(request: Request):
    """
    Endpoint para verificación de disponibilidad (Health Check).
    """
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "rate_limit_limit": settings.RATE_LIMIT_PER_SECOND
    }
