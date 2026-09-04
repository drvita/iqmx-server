import logging
import secrets
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.product import Product
from app.config import settings
from app.lib.crypto import decrypt_token
from app.api.portal_crm import get_crm_internal_url_and_secret

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/internal/products", tags=["internal-products"])


class VerifySecretRequest(BaseModel):
    product_slug: str = "crm"
    secret: str


class VerifySecretResponse(BaseModel):
    ok: bool
    valid: bool
    product_slug: str


@router.post("/verify-secret", response_model=VerifySecretResponse)
def verify_product_secret(
    payload: VerifySecretRequest,
    db: Session = Depends(get_db),
):
    """
    Endpoint de introspección M2M interno (Single Source of Truth).
    Permite al microservicio (ej. CRM) verificar si el Bearer token recibido
    corresponde a la clave legítima autorizada por la API central.
    
    Verifica:
    1. Clave activa (variable de entorno explícita o base de datos).
    2. Clave anterior (api_secret_previous) para soportar Periodo de Gracia en rotaciones.
    """
    provided_secret = payload.secret.strip()
    product_slug = payload.product_slug.strip().lower()

    if not provided_secret:
        return VerifySecretResponse(ok=True, valid=False, product_slug=product_slug)

    crm_product = db.query(Product).filter(Product.slug == product_slug).first()
    if not crm_product:
        logger.warning(f"[verify-secret] Producto '{product_slug}' no encontrado en el catálogo.")
        return VerifySecretResponse(ok=True, valid=False, product_slug=product_slug)

    # 1. Validar contra variable de entorno explícita (si está configurada)
    if product_slug == "crm" and settings.CRM_PROVISION_SECRET and settings.CRM_PROVISION_SECRET != "crm_provision_secret_key_iqmx_default":
        if secrets.compare_digest(provided_secret, settings.CRM_PROVISION_SECRET.strip()):
            return VerifySecretResponse(ok=True, valid=True, product_slug=product_slug)

    # 2. Validar contra clave activa en Base de Datos
    if crm_product.api_secret_encrypted:
        try:
            active_secret = decrypt_token(crm_product.api_secret_encrypted, settings.TOKEN_ENCRYPTION_KEY)
            if active_secret and secrets.compare_digest(provided_secret, active_secret.strip()):
                return VerifySecretResponse(ok=True, valid=True, product_slug=product_slug)
        except Exception as e:
            logger.warning(f"[verify-secret] Error al descifrar api_secret_encrypted para '{product_slug}': {e}")

    # 3. Validar contra clave anterior en Periodo de Gracia
    if crm_product.api_secret_previous:
        try:
            previous_secret = decrypt_token(crm_product.api_secret_previous, settings.TOKEN_ENCRYPTION_KEY)
            if previous_secret and secrets.compare_digest(provided_secret, previous_secret.strip()):
                logger.info(f"[verify-secret] Token validado usando clave anterior en periodo de gracia para '{product_slug}'.")
                return VerifySecretResponse(ok=True, valid=True, product_slug=product_slug)
        except Exception as e:
            logger.warning(f"[verify-secret] Error al descifrar api_secret_previous para '{product_slug}': {e}")

    return VerifySecretResponse(ok=True, valid=False, product_slug=product_slug)
