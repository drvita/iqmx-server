import hashlib

def hash_password(password: str) -> str:
    """
    Genera un hash SHA256 para passwords de forma simple y sin dependencias externas complejas.
    """
    return hashlib.sha256(password.encode("utf-8")).hexdigest()
