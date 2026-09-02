import hmac
import hashlib
import logging
from datetime import datetime, timedelta
import jwt
from fastapi import Request, Header, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.user import User
from app.models.customer import Customer

logger = logging.getLogger("uvicorn.error")

http_bearer = HTTPBearer(auto_error=False)

try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False

def hash_password(password: str) -> str:
    """
    Genera un hash seguro utilizando bcrypt con salt automático, o PBKDF2-HMAC-SHA256 como fallback.
    """
    if HAS_BCRYPT:
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    
    # Fallback criptográfico seguro nativo (PBKDF2 con 100,000 iteraciones y salt aleatorio de 16 bytes)
    import os
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return f"pbkdf2${salt.hex()}${dk.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica una contraseña contra su hash.
    Soporta contraseñas con bcrypt, pbkdf2 y SHA256 legado.
    """
    if not hashed_password:
        return False
        
    # Verificar formato pbkdf2
    if hashed_password.startswith("pbkdf2$"):
        parts = hashed_password.split("$")
        if len(parts) == 3:
            salt = bytes.fromhex(parts[1])
            expected_dk = parts[2]
            dk = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt, 100000).hex()
            return hmac.compare_digest(dk, expected_dk)

    # Verificar si es hash sha256 antiguo (longitud 64 caracteres hex)
    if len(hashed_password) == 64 and not hashed_password.startswith("$2"):
        sha_hash = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(sha_hash, hashed_password)
        
    if HAS_BCRYPT:
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        except Exception:
            return False
            
    return False

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Genera un token JWT para la sesión de un usuario/cliente.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_access_token(token: str) -> dict:
    """
    Decodifica y valida un token JWT.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token de autenticación no válido o expirado: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(
    auth: HTTPAuthorizationCredentials | None = Depends(http_bearer),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency para obtener el usuario autenticado a través del token Bearer JWT.
    """
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta cabecera de autenticación Bearer.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(auth.credentials)
    user_id: int | None = payload.get("sub") or payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no contiene identificador de usuario válido.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado en la base de datos."
        )
    return user

async def get_current_customer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Customer:
    """
    Dependency para obtener el perfil de cliente (Customer) del usuario autenticado.
    Verifica que tenga rol de cliente y un perfil asociado.
    """
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario no tiene un perfil de cliente registrado."
        )
    if not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta del cliente se encuentra inactiva."
        )
    return customer

async def verify_whatsapp_signature(request: Request, x_hub_signature_256: str = Header(None)):
    """
    Dependency para verificar que las peticiones POST provienen genuinamente de Meta.
    Usa la firma X-Hub-Signature-256 calculada con HMAC-SHA256 usando el META_APP_SECRET.
    Migrado tal cual desde el microservicio webhook original.
    """
    # Si no está configurada la llave secreta (ej. en desarrollo local), omitir validación.
    if not settings.META_APP_SECRET:
        logger.warning("META_APP_SECRET no está configurada. Omitiendo validación de firma (Solo permitido en desarrollo).")
        return

    if not x_hub_signature_256:
        logger.error("Falta la cabecera X-Hub-Signature-256 en la petición del Webhook.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta la cabecera X-Hub-Signature-256."
        )

    if not x_hub_signature_256.startswith("sha256="):
        logger.error("Firma inválida: No inicia con el formato 'sha256='.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de firma inválido."
        )

    # Extraer la firma criptográfica (quitar el prefijo 'sha256=')
    received_signature = x_hub_signature_256[7:]

    # Leer el cuerpo en bruto (bytes) de la petición
    body_bytes = await request.body()

    # Calcular la firma esperada usando el App Secret y el cuerpo
    expected_signature = hmac.new(
        settings.META_APP_SECRET.encode("utf-8"),
        body_bytes,
        hashlib.sha256
    ).hexdigest()

    # Comparar de forma segura para prevenir ataques de temporización (timing attacks)
    if not hmac.compare_digest(expected_signature, received_signature):
        logger.error("Fallo de autenticidad: La firma provista no coincide con la firma esperada.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firma digital no válida. Evento rechazado."
        )

    logger.info("Firma digital de Meta validada correctamente.")
