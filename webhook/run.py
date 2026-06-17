import uvicorn
from app.config import settings

if __name__ == "__main__":
    # Inicia uvicorn programáticamente usando los valores configurados
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development"
    )
