import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.api.admin_auth import get_current_admin
from app.config import settings
from app.services.notifications.manager import NotificationManager

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/notifications", tags=["admin-notifications"])


class TestTelegramRequest(BaseModel):
    message: Optional[str] = Field(None, description="Mensaje personalizado para la prueba de Telegram.")


class TestEmailRequest(BaseModel):
    to_email: str = Field(..., description="Correo de destino para la prueba.")
    template_uuid: str = Field(..., description="UUID de la plantilla en Mailtrap.")
    template_variables: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Variables dinámicas para la plantilla.")
    from_name: Optional[str] = Field(None, description="Remitente opcional (ej. 'Soporte IQISS'). Si es None, usa el valor por defecto.")
    from_email: Optional[str] = Field(None, description="Correo remitente opcional. Si es None, usa el valor por defecto.")


@router.get("/status")
def get_notifications_status(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Informa el estado de configuración de los canales de notificación
    (Telegram Bot multi-admin y Mailtrap Send API).
    """
    admin_chat_ids = NotificationManager.get_admin_telegram_chat_ids(db)
    
    return {
        "telegram": {
            "is_token_configured": bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_BOT_TOKEN.strip()),
            "configured_admins_count": len(admin_chat_ids),
            "admin_chat_ids": admin_chat_ids,
        },
        "mailtrap": {
            "is_token_configured": bool(settings.MAILTRAP_API_TOKEN and settings.MAILTRAP_API_TOKEN.strip()),
            "api_url": settings.MAILTRAP_API_URL,
            "default_from_email": settings.MAIL_FROM_EMAIL,
            "default_from_name": settings.MAIL_FROM_NAME,
        }
    }


@router.post("/test-telegram")
def test_telegram_notification(
    req: TestTelegramRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Despacha un mensaje de prueba a todos los administradores con telegram_chat_id configurado.
    """
    msg = req.message or (
        f"🤖 *Prueba de Notificación IQISSMexico*\n\n"
        f"Hola, este es un mensaje de prueba del sistema de notificaciones operativas.\n"
        f"• Solicitado por: {admin.name} ({admin.email})\n"
        f"• Estado: ✅ Sistema conectado exitosamente."
    )

    result = NotificationManager.notify_admins(db=db, message=msg, parse_mode="Markdown")
    return result


@router.post("/test-email")
def test_email_notification(
    req: TestEmailRequest,
    admin: User = Depends(get_current_admin)
):
    """
    Despacha un correo transaccional de prueba mediante plantilla de Mailtrap.
    Permite sobreescribir remitente o utilizar los defaults del sistema.
    """
    variables = req.template_variables or {"user_name": admin.name, "company": "IQISSMexico"}
    
    result = NotificationManager.notify_customer_template(
        to_email=req.to_email,
        template_uuid=req.template_uuid,
        template_variables=variables,
        from_email=req.from_email,
        from_name=req.from_name,
        to_name=admin.name
    )
    return result
