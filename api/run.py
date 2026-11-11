import logging
import subprocess
import uvicorn
from app.config import settings

logger = logging.getLogger("uvicorn.error")

def run_db_migrations():
    """Ejecuta automáticamente las migraciones pendientes de Alembic al iniciar."""
    try:
        logger.info("[startup] Validando y aplicando migraciones de Alembic...")
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            check=True
        )
        if result.stdout:
            logger.info(f"[startup] Resultado Alembic:\n{result.stdout.strip()}")
    except subprocess.CalledProcessError as e:
        logger.error(f"[startup] Falló la ejecución de alembic upgrade head: {e.stderr}")
    except Exception as e:
        logger.warning(f"[startup] No se pudo ejecutar Alembic automáticamente: {e}")

if __name__ == "__main__":
    run_db_migrations()
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development"
    )
