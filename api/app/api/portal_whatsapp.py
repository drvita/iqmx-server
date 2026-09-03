import logging
import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from app.config import settings
from app.db.database import get_db
from app.models.customer import Customer
from app.models.whatsapp_number import WhatsAppNumber
from app.models.customer_webhook import CustomerWebhook
from app.lib.security import get_current_customer
from app.lib.crypto import encrypt_token, decrypt_token
from app.lib.ssrf_validator import validate_webhook_url

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

class WhatsAppCredentialsResponse(BaseModel):
    waba_id: str
    phone_number_id: str
    token: str
    display_phone_number: Optional[str] = None
    verified_name: Optional[str] = None

class ProvisionResponse(BaseModel):
    success: bool
    status_code: Optional[int] = None
    message: str

# --- Helper Functions de Aprovisionamiento ---

async def send_provision_to_crm(
    provision_url: str,
    secret_token: Optional[str],
    waba_id: str,
    phone_number_id: str,
    token: str,
    display_phone_number: Optional[str],
    verified_name: Optional[str]
) -> dict:
    """
    Envía solicitud POST para aprovisionar una línea en el CRM según endpoints.md.
    """
    payload = {
        "wabaId": waba_id,
        "phoneNumberId": phone_number_id,
        "token": token,
        "displayPhoneNumber": display_phone_number,
        "verifiedName": verified_name,
        "label": verified_name or "WhatsApp Business",
        "aiEnabled": True,
        "signupMethod": "embedded_signup"
    }

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "IQMX-Central-Server/1.0",
    }
    if secret_token and secret_token.strip():
        tok = secret_token.strip()
        headers["Authorization"] = f"Bearer {tok}"
        headers["x-provision-key"] = tok

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(provision_url, json=payload, headers=headers)
            is_success = (200 <= response.status_code < 300)
            logger.info(
                f"Aprovisionamiento de línea #{phone_number_id} a '{provision_url}' finalizado con código {response.status_code}."
            )
            return {
                "success": is_success,
                "status_code": response.status_code,
                "message": "Línea aprovisionada exitosamente en el CRM" if is_success else f"El CRM respondió con error HTTP {response.status_code}: {response.text[:200]}"
            }
    except Exception as exc:
        logger.warning(f"Error al contactar el CRM para aprovisionar línea #{phone_number_id}: {exc}")
        return {
            "success": False,
            "status_code": None,
            "message": f"No se pudo conectar con la URL de aprovisionamiento del CRM: {exc}"
        }

async def send_unprovision_to_crm(
    provision_url: str,
    secret_token: Optional[str],
    phone_number_id: str
):
    """
    Envía solicitud DELETE para dar de baja la línea en el CRM según endpoints.md.
    Se ejecuta en background y se ignoran errores en caso de caída del CRM.
    """
    headers = {
        "User-Agent": "IQMX-Central-Server/1.0",
    }
    if secret_token and secret_token.strip():
        tok = secret_token.strip()
        headers["Authorization"] = f"Bearer {tok}"
        headers["x-provision-key"] = tok

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Según endpoints.md: DELETE /api/settings/whatsapp/provision?phoneNumberId=...
            del_url = f"{provision_url}?phoneNumberId={phone_number_id}"
            response = await client.delete(del_url, headers=headers)
            logger.info(
                f"Baja de línea #{phone_number_id} enviada al CRM '{del_url}' -> HTTP {response.status_code}"
            )
    except Exception as exc:
        logger.warning(f"Aviso: No se pudo notificar la baja de línea al CRM: {exc}")

# --- Endpoints ---

@router.post("/exchange", response_model=WhatsAppNumberResponse)
async def exchange_meta_code(
    req: MetaExchangeRequest,
    background_tasks: BackgroundTasks,
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
    7. Si el cliente tiene URL de aprovisionamiento configurada, lanza la sincronización al CRM en background.
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
            logger.error(f"Error al intercambiar código con Meta: {token_res.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código de autorización no válido o expirado."
            )
        
        token_data = token_res.json()
        permanent_token = token_data.get("access_token")
        if not permanent_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Meta no devolvió un access_token válido."
            )

        headers = {"Authorization": f"Bearer {permanent_token}"}
        waba_id = req.waba_id
        phone_number_id = req.phone_number_id

        # 2. Descubrimiento automático si falta waba_id o phone_number_id
        if not waba_id or not phone_number_id:
            logger.info("waba_id o phone_number_id ausentes. Consultando Graph API para auto-descubrir...")
            debug_res = await client.get(
                f"{graph_base}/debug_token?input_token={permanent_token}",
                headers={"Authorization": f"Bearer {settings.META_APP_ID}|{settings.META_APP_SECRET}"}
            )
            if debug_res.status_code == 200:
                debug_data = debug_res.json().get("data", {})
                granular_scopes = debug_data.get("granular_scopes", [])
                for scope in granular_scopes:
                    if scope.get("scope") == "whatsapp_business_management":
                        target_ids = scope.get("target_ids", [])
                        if target_ids:
                            waba_id = target_ids[0]
                            break

            if waba_id:
                pn_res = await client.get(f"{graph_base}/{waba_id}/phone_numbers", headers=headers)
                if pn_res.status_code == 200:
                    pn_data = pn_res.json().get("data", [])
                    if pn_data:
                        phone_number_id = pn_data[0].get("id")

        if not waba_id or not phone_number_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el identificador de la cuenta o del número de WhatsApp."
            )

        # 3. Suscribir la aplicación en Meta a los webhooks de la WABA
        sub_url = f"{graph_base}/{waba_id}/subscribed_apps"
        sub_res = await client.post(sub_url, headers=headers)
        if sub_res.status_code == 200:
            logger.info(f"Aplicación suscrita con éxito en Meta para WABA {waba_id}")
        else:
            logger.warning(f"Aviso al suscribir aplicación en Meta: {sub_res.text}")

        # 4. Consultar detalles de la línea en Meta
        detail_url = f"{graph_base}/{phone_number_id}?fields=display_phone_number,verified_name"
        detail_res = await client.get(detail_url, headers=headers)
        display_phone_number = None
        verified_name = None
        if detail_res.status_code == 200:
            d_json = detail_res.json()
            display_phone_number = d_json.get("display_phone_number")
            verified_name = d_json.get("verified_name")

    # 5. Cifrar token de acceso permanente con AES-256-GCM
    encrypted_token_str = encrypt_token(permanent_token, settings.TOKEN_ENCRYPTION_KEY)

    # 6. Persistir en base de datos
    existing_number = db.query(WhatsAppNumber).filter(
        WhatsAppNumber.phone_number_id == str(phone_number_id)
    ).first()

    if existing_number:
        if existing_number.customer_id != current_customer.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este número telefónico ya está vinculado a otra cuenta."
            )
        existing_number.waba_id = str(waba_id)
        existing_number.display_phone_number = display_phone_number
        existing_number.verified_name = verified_name
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

    # 7. Intentar aprovisionamiento automático en segundo plano si hay URL configurada
    cust_webhook = db.query(CustomerWebhook).filter(
        CustomerWebhook.customer_id == current_customer.id
    ).first()

    if cust_webhook and cust_webhook.provision_url and cust_webhook.provision_url.strip():
        background_tasks.add_task(
            send_provision_to_crm,
            provision_url=cust_webhook.provision_url.strip(),
            secret_token=cust_webhook.secret_token,
            waba_id=str(waba_id),
            phone_number_id=str(phone_number_id),
            token=permanent_token,
            display_phone_number=display_phone_number,
            verified_name=verified_name
        )

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

@router.get("/numbers/{number_id}/credentials", response_model=WhatsAppCredentialsResponse)
async def get_number_credentials(
    number_id: int,
    current_customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Retorna las credenciales desencriptadas de la línea de WhatsApp para configuración manual en el CRM.
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

    try:
        decrypted_token = decrypt_token(number.encrypted_token, settings.TOKEN_ENCRYPTION_KEY)
    except Exception as e:
        logger.error(f"Error al desencriptar token de WhatsApp #{number_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo descifrar la credencial de acceso de Meta."
        )

    return WhatsAppCredentialsResponse(
        waba_id=number.waba_id,
        phone_number_id=number.phone_number_id,
        token=decrypted_token,
        display_phone_number=number.display_phone_number,
        verified_name=number.verified_name
    )

@router.post("/numbers/{number_id}/provision", response_model=ProvisionResponse)
async def provision_number_manually(
    number_id: int,
    current_customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Ejecuta el aprovisionamiento manual de la línea hacia la URL del CRM configurada.
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

    cust_webhook = db.query(CustomerWebhook).filter(
        CustomerWebhook.customer_id == current_customer.id
    ).first()

    if not cust_webhook or not cust_webhook.provision_url or not cust_webhook.provision_url.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tienes configurada la Dirección Web de Aprovisionamiento en la tarjeta de conexión."
        )

    try:
        decrypted_token = decrypt_token(number.encrypted_token, settings.TOKEN_ENCRYPTION_KEY)
    except Exception as e:
        logger.error(f"Error al desencriptar token para aprovisionamiento #{number_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible descifrar el token permanente de Meta."
        )

    result = await send_provision_to_crm(
        provision_url=cust_webhook.provision_url.strip(),
        secret_token=cust_webhook.secret_token,
        waba_id=number.waba_id,
        phone_number_id=number.phone_number_id,
        token=decrypted_token,
        display_phone_number=number.display_phone_number,
        verified_name=number.verified_name
    )

    return ProvisionResponse(
        success=result["success"],
        status_code=result["status_code"],
        message=result["message"]
    )

@router.delete("/numbers/{number_id}")
async def delete_whatsapp_number(
    number_id: int,
    background_tasks: BackgroundTasks,
    current_customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Desvincula un número telefónico de WhatsApp.
    1. Si era el único número activo para esa WABA, ejecuta DELETE subscribed_apps en Meta.
    2. Si hay URL de aprovisionamiento en el CRM, envía la baja en segundo plano (ignorando errores).
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
    phone_number_id = number.phone_number_id
    token_decrypted = None
    try:
        token_decrypted = decrypt_token(number.encrypted_token, settings.TOKEN_ENCRYPTION_KEY)
    except Exception as e:
        logger.warning(f"No se pudo descifrar token para desuscripción en Meta: {e}")

    # Notificar desvinculación al CRM en background si hay URL configurada
    cust_webhook = db.query(CustomerWebhook).filter(
        CustomerWebhook.customer_id == current_customer.id
    ).first()

    if cust_webhook and cust_webhook.provision_url and cust_webhook.provision_url.strip():
        background_tasks.add_task(
            send_unprovision_to_crm,
            provision_url=cust_webhook.provision_url.strip(),
            secret_token=cust_webhook.secret_token,
            phone_number_id=phone_number_id
        )

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
