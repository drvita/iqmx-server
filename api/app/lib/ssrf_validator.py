import socket
import ipaddress
from urllib.parse import urlparse

def is_ip_private_or_reserved(ip_str: str) -> bool:
    """
    Verifica si una dirección IP es privada, loopback, link-local, multicast o reservada.
    """
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        )
    except ValueError:
        return True


def is_trusted_internal_url(url: str) -> bool:
    """
    Verifica si la URL pertenece a un microservicio interno de confianza (ej. contenedor CRM en Docker).
    """
    if not url:
        return False
    try:
        from app.config import settings
        trusted_hosts = {"crm"}
        if settings.CRM_SERVICE_URL:
            parsed_crm = urlparse(settings.CRM_SERVICE_URL)
            if parsed_crm.hostname:
                trusted_hosts.add(parsed_crm.hostname.lower())

        parsed = urlparse(url.strip())
        if parsed.hostname and parsed.hostname.lower() in trusted_hosts:
            return True
    except Exception:
        pass
    return False

def validate_webhook_url(url: str, allow_http_in_dev: bool = False) -> tuple[bool, str]:
    """
    Valida rigurosamente que una URL sea apta para despacho de webhooks y previene SSRF.
    Retorna (True, "") si es válida, o (False, "motivo de rechazo") si no lo es.
    """
    if not url or not isinstance(url, str):
        return False, "La URL no puede estar vacía."

    url_trimmed = url.strip()
    if is_trusted_internal_url(url_trimmed):
        return True, ""

    try:
        parsed = urlparse(url_trimmed)
    except Exception:
        return False, "Formato de URL no válido."

    # Validar esquema
    valid_schemes = ("https", "http") if allow_http_in_dev else ("https",)
    if parsed.scheme not in valid_schemes:
        return False, "La URL debe utilizar obligatoriamente el protocolo HTTPS."

    hostname = parsed.hostname
    if not hostname:
        return False, "La URL debe incluir un nombre de host válido."

    # Rechazar localhost explícito
    if hostname.lower() in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
        return False, "No se permiten direcciones locales (localhost)."

    # Resolver DNS y verificar todas las direcciones IP resultantes
    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return False, f"No se pudo resolver el nombre de host '{hostname}' mediante DNS."
    except Exception as e:
        return False, f"Error al validar el host de la URL: {e}"

    if not addr_info:
        return False, f"El host '{hostname}' no resolvió a ninguna dirección IP."

    for item in addr_info:
        ip_addr = item[4][0]
        if is_ip_private_or_reserved(ip_addr):
            return False, f"La URL resuelve a una dirección de red privada o no permitida ({ip_addr})."

    return True, ""
