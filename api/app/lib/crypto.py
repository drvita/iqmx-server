import os
import base64
import hmac
import hashlib
import secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def get_key_bytes(key: str | bytes) -> bytes:
    """
    Normaliza la clave de cifrado a 32 bytes (256 bits).
    Si es un string hex de 64 caracteres, lo decodifica. Si es texto, aplica SHA-256 para derivar 32 bytes exactos.
    """
    if isinstance(key, bytes):
        if len(key) == 32:
            return key
        return hashlib.sha256(key).digest()
    
    key_str = str(key).strip()
    try:
        if len(key_str) == 64:
            b = bytes.fromhex(key_str)
            if len(b) == 32:
                return b
    except ValueError:
        pass
    
    return hashlib.sha256(key_str.encode("utf-8")).digest()

def encrypt_token(plain_text: str, key: str | bytes) -> str:
    """
    Cifra una cadena de texto (ej. access token de Meta) usando AES-256-GCM.
    Retorna un string base64 que contiene: nonce (12 bytes) + tag/ciphertext.
    """
    if not plain_text:
        return ""
    key_bytes = get_key_bytes(key)
    aesgcm = AESGCM(key_bytes)
    # Nonce de 12 bytes recomendado por NIST para AES-GCM
    nonce = os.urandom(12)
    # AESGCM.encrypt concatena ciphertext + tag (16 bytes)
    ciphertext = aesgcm.encrypt(nonce, plain_text.encode("utf-8"), None)
    # Concatenar nonce + ciphertext_con_tag
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode("utf-8")

def decrypt_token(encrypted_str: str, key: str | bytes) -> str:
    """
    Descifra un string cifrado con encrypt_token usando AES-256-GCM.
    Valida la autenticidad del tag; si fue manipulado, lanza una excepción.
    """
    if not encrypted_str:
        return ""
    key_bytes = get_key_bytes(key)
    aesgcm = AESGCM(key_bytes)
    combined = base64.b64decode(encrypted_str.encode("utf-8"))
    nonce = combined[:12]
    ciphertext = combined[12:]
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted_bytes.decode("utf-8")

def calculate_hmac_sha256(secret: str, data_bytes: bytes) -> str:
    """
    Calcula la firma HMAC-SHA256 de un payload en bytes con una clave secreta.
    """
    return hmac.new(
        secret.encode("utf-8"),
        data_bytes,
        hashlib.sha256
    ).hexdigest()

def generate_secure_secret(length: int = 32) -> str:
    """
    Genera un token hexadecimal criptográficamente seguro.
    """
    return secrets.token_hex(length)
