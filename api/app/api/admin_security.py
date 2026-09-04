import logging
import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.product import Product
from app.api.admin_auth import get_current_admin
from app.models.user import User
from app.config import settings
from app.lib.crypto import encrypt_token

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/security", tags=["admin-security"])

@router.post("/rotate-keys")
def rotate_m2m_keys(
    product_slug: str = "crm",
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Rota la clave secreta M2M de un producto (ej. CRM) aplicando el estándar de
    Doble Llave con Periodo de Gracia (Grace Period).
    
    1. La clave actual pasa a ser api_secret_previous.
    2. Se genera una nueva clave criptográfica aleatoria de 64 caracteres hex (32 bytes).
    3. Se guarda cifrada con AES-256-GCM en la base de datos PostgreSQL compartida.
    4. Se actualiza last_key_rotation_at.
    """
    product = db.query(Product).filter(Product.slug == product_slug).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    # Generar nueva clave criptosegura
    new_secret_raw = secrets.token_hex(32)
    new_secret_encrypted = encrypt_token(new_secret_raw, settings.TOKEN_ENCRYPTION_KEY)

    # Rotación: la actual pasa a ser previous
    product.api_secret_previous = product.api_secret_encrypted
    product.api_secret_encrypted = new_secret_encrypted
    product.last_key_rotation_at = datetime.utcnow()

    db.commit()
    db.refresh(product)

    logger.info(f"🔑 Rotación de clave M2M completada para el producto '{product.slug}' por admin #{admin.id}")

    return {
        "ok": True,
        "product_slug": product.slug,
        "rotated_at": product.last_key_rotation_at.isoformat(),
        "message": "Clave rotada exitosamente. La clave anterior sigue siendo válida durante el periodo de gracia."
    }
