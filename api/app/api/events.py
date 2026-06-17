import logging
from fastapi import APIRouter, Request, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.event import Event

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/events", tags=["events"])

@router.post("")
async def create_event(request: Request, db: Session = Depends(get_db)):
    """
    Endpoint para recibir y almacenar un evento de WhatsApp.
    Se encarga de parsear el payload de Meta para extraer los campos clave.
    """
    try:
        payload = await request.json()
        
        # Extracción segura de metadatos del webhook de WhatsApp
        wa_id = None
        message_id = None
        message_body = None
        
        try:
            entry = payload.get("entry", [])
            if entry:
                changes = entry[0].get("changes", [])
                if changes:
                    value = changes[0].get("value", {})
                    
                    # Extraer wa_id del remitente
                    contacts = value.get("contacts", [])
                    if contacts:
                        wa_id = contacts[0].get("wa_id")
                    
                    # Extraer información del primer mensaje si existe
                    messages = value.get("messages", [])
                    if messages:
                        msg = messages[0]
                        message_id = msg.get("id")
                        msg_type = msg.get("type")
                        if msg_type == "text":
                            message_body = msg.get("text", {}).get("body")
        except Exception as parse_error:
            logger.warning(f"No se pudo extraer metadata detallada del payload: {parse_error}")

        new_event = Event(
            wa_id=wa_id,
            message_id=message_id,
            message_body=message_body,
            payload=payload
        )
        
        db.add(new_event)
        db.commit()
        db.refresh(new_event)
        
        logger.info(f"Evento guardado exitosamente en API. ID: {new_event.id}")
        return {"status": "success", "id": new_event.id}
    except Exception as e:
        logger.error(f"Error al guardar evento en API: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error processing event payload"
        )
