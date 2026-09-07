import logging
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.user import User
from app.models.role import Role
from app.services.notifications.telegram import send_telegram_message
from app.services.notifications.mailtrap import send_mailtrap_template

logger = logging.getLogger("uvicorn.error")


class NotificationManager:
    """
    Gestor centralizado y unificado de notificaciones.
    Orquesta el envío de alertas operativas a administradores vía Telegram
    y comunicaciones transaccionales a clientes vía Mailtrap.
    """

    @staticmethod
    def get_admin_telegram_chat_ids(db: Session) -> List[str]:
        """
        Consulta todos los usuarios con rol 'admin' que tengan configurado
        un telegram_chat_id válido y no vacío.
        """
        # Busca usuarios asociados a admin tanto por relación secondary como por foreign_key legacy
        admins = db.query(User).filter(
            User.telegram_chat_id.isnot(None),
            User.telegram_chat_id != ""
        ).all()

        chat_ids = set()
        for user in admins:
            if user.has_role("admin") and user.telegram_chat_id:
                clean_id = str(user.telegram_chat_id).strip()
                if clean_id:
                    chat_ids.add(clean_id)

        return sorted(list(chat_ids))

    @classmethod
    def notify_admins(
        cls,
        message: str,
        db: Optional[Session] = None,
        parse_mode: str = "Markdown",
    ) -> Dict[str, Any]:
        """
        Envía una notificación operativa a todos los administradores con telegram_chat_id configurado.
        Si no hay ningún administrador con chat_id configurado, no envía nada y registra un log informativo.
        
        :param message: Texto del mensaje a enviar.
        :param db: Sesión de SQLAlchemy activa opcional. Si es None, abre una nueva sesión.
        :param parse_mode: Formato del mensaje ('Markdown' o 'HTML').
        :return: Resumen de resultados del envío.
        """
        if db is None:
            from app.db.database import SessionLocal
            with SessionLocal() as session:
                return cls.notify_admins(message=message, db=session, parse_mode=parse_mode)

        chat_ids = cls.get_admin_telegram_chat_ids(db)

        if not chat_ids:
            logger.info(
                "[NotificationManager] No hay usuarios administradores con telegram_chat_id configurado. "
                "Omitiendo despacho de notificación."
            )
            return {
                "sent": 0,
                "failed": 0,
                "total_admins": 0,
                "status": "skipped",
                "reason": "no_configured_admins",
            }

        success_count = 0
        failed_count = 0
        results = []

        for cid in chat_ids:
            res = send_telegram_message(
                chat_id=cid,
                text=message,
                parse_mode=parse_mode,
            )
            results.append(res)
            if res.get("success"):
                success_count += 1
            else:
                failed_count += 1

        logger.info(
            f"[NotificationManager] Notificación a administradores completada: "
            f"{success_count} exitosos, {failed_count} fallidos de {len(chat_ids)} destinatarios."
        )

        return {
            "sent": success_count,
            "failed": failed_count,
            "total_admins": len(chat_ids),
            "status": "completed" if failed_count == 0 else "partial_failure",
            "details": results,
        }

    @staticmethod
    def notify_customer_template(
        to_email: str,
        template_uuid: str,
        template_variables: Dict[str, Any],
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        to_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Despacha un correo transaccional al cliente utilizando una plantilla registrada en Mailtrap.
        
        :param to_email: Correo del cliente receptor.
        :param template_uuid: Identificador UUID de la plantilla en Mailtrap.
        :param template_variables: Variables dinámicas para rellenar la plantilla.
        :param from_email: Correo del remitente opcional (por defecto settings.MAIL_FROM_EMAIL).
        :param from_name: Nombre del remitente opcional (por defecto settings.MAIL_FROM_NAME).
        :param to_name: Nombre del cliente destinatario opcional.
        """
        return send_mailtrap_template(
            to_email=to_email,
            template_uuid=template_uuid,
            template_variables=template_variables,
            from_email=from_email,
            from_name=from_name,
            to_name=to_name,
        )
