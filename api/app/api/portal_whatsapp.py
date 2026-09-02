import logging
import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from app.config import settings
from app.db.database import get_db
from app.models.customer import Customer
from app.models.whatsapp_number import WhatsAppNumber
from app.lib.security import get_current_customer
from app.lib.crypto import encrypt_token, decrypt_token

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/portal/whatsapp", tags=["portal-whatsapp"])

# --- Schemas ---

class MetaExchangeRequest(BaseModel):
    code: str
    waba_id: Optional[str] = None
    phone_number_id: Optional[str] = None

class WhatsAppNumberResponse(BaseModel):
    id: int
    phone_number_id: str
    waba_id: str
    display_phone_number: Optional[str]
    verified_name: Optional[str]
    status: str
    created_at: datetime

# --- Endpoints ---

@router.post("/exchange", response_model=WhatsAppNumberResponse)
async def exchange_meta_code(
    req: MetaExchangeRequest,
    current_customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Recibe el authorization code devuelto por el modal de Facebook SDK (Embedded Signup Coexistencia).
    1. Intercambia el code por un token de acceso permanente en Meta Graph API.
    2. Auto-descubre waba_id y phone_number_id si no fueron entregados por el frontend.
    3. Valida que el phone_number_id no pertenezca a otro cliente.
    4. Suscribe la aplicación en Meta mediante POST /{waba_id}/subscribed_apps.
    5. Obtiene nombre verificado y número internacional.
    6. Cifra el token con AES-256-GCM y persiste en whatsapp_numbers.
    """
    if not settings.META_APP_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="META_APP_SECRET no está configurada en el servidor."
        )

    code = req.code.strip()
    graph_base = f"https://graph.facebook.com/{settings.GRAPH_API_VERSION}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Intercambiar code por token permanente
        token_url = (
            f"{graph_base}/oauth/access_token"
            f"?client_id={settings.META_APP_ID}"
            f"&client_secret={settings.META_APP_SECRET}"
            f"&code={code}"
        )
        token_res = await client.get(token_url)
        if token_res.status_code != 200:
            logger.error(f"Error intercambiando code con Meta: {token_res.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fallo en la autorización con Meta: {token_res.text}"
            )
        
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Meta no retornó un access_token válido."
            )

        waba_id = req.waba_id
        phone_number_id = req.phone_number_id

        # 2. Auto-descubrimiento si no venían en la petición
        if not waba_id or not phone_number_id:
            # Consultar debug_token
            debug_url = f"{graph_base}/debug_token?input_token={access_token}&access_token={settings.META_APP_ID}|{settings.META_APP_SECRET}"
            debug_res = await client.get(debug_url)
            if debug_res.status_code == 200:
                debug_data = debug_res.json().get("data", {})
                granular_scopes = debug_data.get("granular_scopes", [])
                for scope in granular_scopes:
                    if scope.get("scope") == "whatsapp_business_management":
                        target_ids = scope.get("target_ids", [])
                        if target_ids and not waba_id:
                            waba_id = str(target_ids[0])
            
            # Si tenemos waba_id pero falta phone_number_id, consultar /{waba_id}/phone_numbers
            if waba_id and not phone_number_id:
                pn_url = f"{graph_base}/{waba_id}/phone_numbers?access_token={access_token}"
                pn_res = await client.get(pn_url)
                if pn_res.status_code == 200:
                    pns = pn_res.json().get("data", [])
                    if pns:
                        phone_number_id = str(pns[0].get("id"))

        if not waba_id or not phone_number_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo determinar el WABA ID o el Phone Number ID de la cuenta de WhatsApp conectada."
            )

        # 3. Validar suplantación de identidad
        existing_number = db.query(WhatsAppNumber).filter(WhatsAppNumber.phone_number_id == str(phone_number_id)).first()
        if existing_number and existing_number.customer_id != current_customer.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este número telefónico de WhatsApp ya está vinculado a otra empresa cliente."
            )

        # 4. Suscribir la app a la WABA en Meta
        sub_url = f"{graph_base}/{waba_id}/subscribed_apps"
        sub_res = await client.post(sub_url, headers={"Authorization": f"Bearer {access_token}"})
        if sub_res.status_code != 200:
            logger.warning(f"Respuesta inesperada al suscribir webhooks en Meta: {sub_res.text}")

        # 5. Obtener información del número
        info_url = f"{graph_base}/{phone_number_id}?fields=display_phone_number,verified_name&access_token={access_token}"
        info_res = await client.get(info_url)
        display_phone_number = None
        verified_name = None
        if info_res.status_code == 200:
            info_data = info_res.json()
            display_phone_number = info_data.get("display_phone_number")
            verified_name = info_data.get("verified_name")

    # 6. Cifrar token con AES-256-GCM
    encrypted_token_str = encrypt_token(access_token, settings.TOKEN_ENCRYPTION_KEY)

    # 7. Persistir en la base de datos
    if existing_number:
        existing_number.waba_id = str(waba_id)
        existing_number.display_phone_number = display_phone_number or existing_number.display_phone_number
        existing_number.verified_name = verified_name or existing_number.verified_name
        existing_number.encrypted_token = encrypted_token_str
        existing_number.status = "connected"
        existing_number.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_number)
        number_obj = existing_number
    else:
        number_obj = WhatsAppNumber(
            customer_id=current_customer.id,
            phone_number_id=str(phone_number_id),
            waba_id=str(waba_id),
            display_phone_number=display_phone_number,
            verified_name=verified_name,
            encrypted_token=encrypted_token_str,
            status="connected"
        )
        db.add(number_obj)
        db.commit()
        db.refresh(number_obj)

    logger.info(f"Número de WhatsApp #{number_obj.id} vinculado con éxito para cliente #{current_customer.id}")

    return WhatsAppNumberResponse(
        id=number_obj.id,
        phone_number_id=number_obj.phone_number_id,
        waba_id=number_obj.waba_id,
        display_phone_number=number_obj.display_phone_number,
        verified_name=number_obj.verified_name,
        status=number_obj.status,
        created_at=number_obj.created_at
    )

@router.get("/numbers", response_model=List[WhatsAppNumberResponse])
async def list_customer_numbers(
    current_customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Retorna la lista de números telefónicos de WhatsApp vinculados al cliente autenticado.
    """
    numbers = db.query(WhatsAppNumber).filter(
        WhatsAppNumber.customer_id == current_customer.id
    ).order_by(WhatsAppNumber.created_at.desc()).all()

    return [
        WhatsAppNumberResponse(
            id=num.id,
            phone_number_id=num.phone_number_id,
            waba_id=num.waba_id,
            display_phone_number=num.display_phone_number,
            verified_name=num.verified_name,
            status=num.status,
            created_at=num.created_at
        )
        for num in numbers
    ]

@router.delete("/numbers/{number_id}")
async def delete_customer_number(
    number_id: int,
    current_customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Desvincula un número telefónico de WhatsApp.
    Si era el único número activo para esa WABA, ejecuta DELETE subscribed_apps en Meta.
    """
    number = db.query(WhatsAppNumber).filter(
        WhatsAppNumber.id == number_id,
        WhatsAppNumber.customer_id == current_customer.id
    ).first()

    if not number:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Número telefónico no encontrado o no pertenece a su cuenta."
        )

    waba_id = number.waba_id
    token_decrypted = None
    try:
        token_decrypted = decrypt_token(number.encrypted_token, settings.TOKEN_ENCRYPTION_KEY)
    except Exception as e:
        logger.warning(f"No se pudo descifrar token para desuscripción en Meta: {e}")

    # Verificar si quedan más números asociados a esta WABA
    other_numbers_count = db.query(WhatsAppNumber).filter(
        WhatsAppNumber.waba_id == waba_id,
        WhatsAppNumber.id != number.id
    ).count()

    # Si es el último número, desuscribir la app en Meta
    if other_numbers_count == 0 and token_decrypted:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                del_url = f"https://graph.facebook.com/{settings.GRAPH_API_VERSION}/{waba_id}/subscribed_apps"
                await client.delete(del_url, headers={"Authorization": f"Bearer {token_decrypted}"})
                logger.info(f"Subscribed apps eliminada en Meta para WABA {waba_id}")
        except Exception as meta_del_err:
            logger.warning(f"No se pudo desuscribir app en Meta: {meta_del_err}")

    db.delete(number)
    db.commit()

    logger.info(f"Número de WhatsApp #{number_id} eliminado por el cliente #{current_customer.id}")
    return {"status": "success", "message": "Número de WhatsApp desvinculado correctamente."}
