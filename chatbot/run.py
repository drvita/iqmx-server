import os
import uvicorn
from dotenv import load_dotenv

# Carga las variables de entorno locales
load_dotenv()

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    try:
        port = int(os.getenv("PORT", "8000"))
    except ValueError:
        port = 8000
    
    environment = os.getenv("ENVIRONMENT", "development")
    
    uvicorn.run(
        "src.main:app",
        host=host,
        port=port,
        reload=(environment == "development")
    )
