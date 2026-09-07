import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.lib.redis_client import get_redis_client
from app.models.user import User
from app.models.event import Event

logger = logging.getLogger("uvicorn.error")


def cleanup_ephemeral_verification_tokens(db: Session, dry_run: bool = False) -> Dict[str, Any]:
    """
    Escanea e higieniza los tokens efímeros de verificación de correo en Redis.
    
    Reglas de purga:
    1. Claves huérfanas: 'user_email_verify:{id}' sin 'email_verify:{token}' o viceversa.
    2. Tokens de usuarios ya verificados: Si User.email_verified_at ya no es nulo, se libera el token.
    3. Tokens de usuarios inexistentes en la base de datos PostgreSQL.
    4. Claves con TTL <= 0 que Redis no haya purgado de inmediato.
    """
    r = get_redis_client()
    summary = {
        "scanned_token_keys": 0,
        "scanned_user_keys": 0,
        "purged_already_verified": 0,
        "purged_nonexistent_user": 0,
        "purged_orphaned_keys": 0,
        "purged_expired_ttl": 0,
        "total_purged": 0,
        "dry_run": dry_run,
    }

    keys_to_delete = set()

    # 1. Escanear claves email_verify:*
    try:
        token_keys = list(r.scan_iter("email_verify:*", count=100))
        summary["scanned_token_keys"] = len(token_keys)

        for t_key in token_keys:
            token = t_key.replace("email_verify:", "")
            ttl = r.ttl(t_key)

            if ttl == -2:
                # Ya no existe
                continue
            if ttl == 0:
                keys_to_delete.add(t_key)
                summary["purged_expired_ttl"] += 1
                continue

            user_id_str = r.get(t_key)
            if not user_id_str:
                keys_to_delete.add(t_key)
                summary["purged_orphaned_keys"] += 1
                continue

            try:
                user_id = int(user_id_str)
            except ValueError:
                keys_to_delete.add(t_key)
                summary["purged_orphaned_keys"] += 1
                continue

            # Validar existencia y estado en PostgreSQL
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                keys_to_delete.add(t_key)
                keys_to_delete.add(f"user_email_verify:{user_id}")
                summary["purged_nonexistent_user"] += 1
            elif user.email_verified_at is not None:
                keys_to_delete.add(t_key)
                keys_to_delete.add(f"user_email_verify:{user_id}")
                summary["purged_already_verified"] += 1

        # 2. Escanear claves user_email_verify:* para detectar huérfanas
        user_keys = list(r.scan_iter("user_email_verify:*", count=100))
        summary["scanned_user_keys"] = len(user_keys)

        for u_key in user_keys:
            user_id_part = u_key.replace("user_email_verify:", "")
            token_val = r.get(u_key)
            if not token_val:
                keys_to_delete.add(u_key)
                summary["purged_orphaned_keys"] += 1
                continue

            # Verificar si existe la clave inversa
            corresp_token_key = f"email_verify:{token_val}"
            if not r.exists(corresp_token_key):
                keys_to_delete.add(u_key)
                summary["purged_orphaned_keys"] += 1

        summary["total_purged"] = len(keys_to_delete)

        if not dry_run and keys_to_delete:
            r.delete(*list(keys_to_delete))
            logger.info(f"[Maintenance] Purgadas {len(keys_to_delete)} claves efímeras de Redis.")

    except Exception as e:
        logger.error(f"[Maintenance] Error escaneando claves de Redis: {e}")
        summary["error"] = str(e)

    return summary


def cleanup_old_webhook_events(
    db: Session,
    days_successful: int = 30,
    days_failed: int = 60,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Purga registros históricos de webhook events en la tabla 'events'.
    - Eventos entregados/enviados con más de 'days_successful' días.
    - Eventos fallidos permanentes con más de 'days_failed' días.
    """
    now = datetime.utcnow()
    cutoff_successful = now - timedelta(days=days_successful)
    cutoff_failed = now - timedelta(days=days_failed)

    summary = {
        "days_successful_threshold": days_successful,
        "days_failed_threshold": days_failed,
        "purged_successful": 0,
        "purged_failed": 0,
        "total_purged": 0,
        "dry_run": dry_run,
    }

    try:
        # 1. Eventos exitosos
        query_success = db.query(Event).filter(
            Event.delivery_status.in_(["delivered", "sent"]),
            Event.created_at < cutoff_successful
        )
        count_success = query_success.count()
        summary["purged_successful"] = count_success

        # 2. Eventos fallidos antiguos
        query_failed = db.query(Event).filter(
            Event.delivery_status == "failed",
            Event.created_at < cutoff_failed
        )
        count_failed = query_failed.count()
        summary["purged_failed"] = count_failed

        summary["total_purged"] = count_success + count_failed

        if not dry_run and summary["total_purged"] > 0:
            query_success.delete(synchronize_session=False)
            query_failed.delete(synchronize_session=False)
            db.commit()
            logger.info(
                f"[Maintenance] Purgados {summary['total_purged']} eventos históricos de webhooks "
                f"({count_success} exitosos, {count_failed} fallidos)."
            )

    except Exception as e:
        db.rollback()
        logger.error(f"[Maintenance] Error purgando eventos históricos: {e}")
        summary["error"] = str(e)

    return summary


def run_system_maintenance(db: Session, dry_run: bool = False) -> Dict[str, Any]:
    """
    Ejecuta el ciclo de mantenimiento integral (Job 4):
    1. Limpieza de tokens en Redis.
    2. Depuración de eventos de webhook históricos en BD.
    """
    started_at = datetime.utcnow()
    tokens_res = cleanup_ephemeral_verification_tokens(db=db, dry_run=dry_run)
    events_res = cleanup_old_webhook_events(db=db, dry_run=dry_run)
    ended_at = datetime.utcnow()

    return {
        "started_at": started_at.isoformat(),
        "ended_at": ended_at.isoformat(),
        "duration_seconds": round((ended_at - started_at).total_seconds(), 3),
        "dry_run": dry_run,
        "tokens": tokens_res,
        "events": events_res,
    }
