import logging
from typing import Optional
import redis

from app.config import settings

logger = logging.getLogger("uvicorn.error")

_redis_pool: Optional[redis.ConnectionPool] = None


def get_redis_client() -> redis.Redis:
    """
    Retorna un cliente de Redis utilizando un pool de conexiones reutilizable.
    """
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.ConnectionPool.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20
        )
    return redis.Redis(connection_pool=_redis_pool)


def save_email_verification_token(user_id: int, token: str, ttl_seconds: int = 86400) -> None:
    """
    Guarda el token efímero de verificación de correo en Redis con expiración automática (TTL).
    Invalida cualquier token previo existente para el mismo usuario.
    
    :param user_id: ID del usuario.
    :param token: Cadena criptográfica única.
    :param ttl_seconds: Tiempo de vida en segundos (por defecto 24 horas = 86400).
    """
    r = get_redis_client()
    user_key = f"user_email_verify:{user_id}"
    token_key = f"email_verify:{token}"

    # Invalida token previo si existiese
    old_token = r.get(user_key)
    if old_token:
        r.delete(f"email_verify:{old_token}")

    pipe = r.pipeline()
    pipe.set(token_key, str(user_id), ex=ttl_seconds)
    pipe.set(user_key, token, ex=ttl_seconds)
    pipe.execute()
    logger.info(f"[Redis] Token de verificación guardado para User #{user_id} (TTL: {ttl_seconds}s).")


def consume_email_verification_token(token: str) -> Optional[int]:
    """
    Verifica y consume un token de verificación de email en Redis.
    Al consumirse, el token se elimina inmediatamente para garantizar un solo uso.
    
    :param token: Cadena del token recibido.
    :return: user_id si el token es válido y vigente; None en caso contrario.
    """
    if not token or not str(token).strip():
        return None

    r = get_redis_client()
    token_key = f"email_verify:{token.strip()}"
    user_id_str = r.get(token_key)

    if not user_id_str:
        logger.warning(f"[Redis] Intento de validar token inexistente o expirado: {token[:8]}...")
        return None

    try:
        user_id = int(user_id_str)
        user_key = f"user_email_verify:{user_id}"

        # Eliminar atómicamente para quemar el token
        pipe = r.pipeline()
        pipe.delete(token_key)
        pipe.delete(user_key)
        pipe.execute()

        logger.info(f"[Redis] Token de verificación consumido exitosamente para User #{user_id}.")
        return user_id
    except ValueError:
        return None


def get_user_id_from_verification_token(token: str) -> Optional[int]:
    """
    Consulta pasivamente a qué usuario corresponde el token sin consumirlo.
    Útil para mostrar el correo o nombre del usuario en la pantalla interactiva antes del clic.
    """
    if not token or not str(token).strip():
        return None

    r = get_redis_client()
    user_id_str = r.get(f"email_verify:{token.strip()}")
    if user_id_str:
        try:
            return int(user_id_str)
        except ValueError:
            return None
    return None
