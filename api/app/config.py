from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    
    # Configuración de Base de Datos
    DATABASE_TYPE: str = "sqlite"  # "sqlite" o "postgresql"
    SQLITE_DB_PATH: str = "./whatsapp_events.db"
    
    # Credenciales de PostgreSQL
    DB_HOST: str | None = None
    DB_PORT: int = 5432
    DB_USER: str | None = None
    DB_PASSWORD: str | None = None
    DB_NAME: str | None = None

    # Meta Graph API y WhatsApp Webhooks
    WHATSAPP_VERIFY_TOKEN: str = "iqmx_webhook_verify_token_default"
    META_APP_ID: str = "1560064249064360"
    META_APP_SECRET: str | None = None
    META_CONFIG_ID: str = "968187492720390"
    GRAPH_API_VERSION: str = "v26.0"
    META_BUSINESS_ID: str = "3649198765130252"
    # Rate Limiting
    RATE_LIMIT_PER_SECOND: int = 35

    # Cifrado de Tokens en Reposo (AES-256-GCM clave de 32 bytes o string)
    TOKEN_ENCRYPTION_KEY: str = "super_secure_token_encryption_key_32_bytes_long_iqmx"

    # Autenticación JWT para Clientes y Administradores del Portal
    JWT_SECRET_KEY: str = "portal_jwt_secret_key_change_in_production_iqmx_2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 días

    # Credenciales de Mercado Pago (Pagos Recurrentes / Suscripciones)
    MERCADOPAGO_ACCESS_TOKEN: str | None = None
    MERCADOPAGO_PUBLIC_KEY: str | None = None
    MERCADOPAGO_WEBHOOK_SECRET: str | None = None
    MERCADOPAGO_TEST_PAYER_EMAIL: str | None = None

    # Microservicio CRM (Aprovisionamiento y Control M2M)
    CRM_SERVICE_URL: str = "http://crm:3000"
    CRM_PROVISION_SECRET: str = "crm_provision_secret_key_iqmx_default"

    # Notificaciones Operativas (Telegram Bot)
    TELEGRAM_BOT_TOKEN: str | None = None

    # Notificaciones Transaccionales (Mailtrap Send API)
    MAILTRAP_API_TOKEN: str | None = None
    MAILTRAP_API_URL: str = "https://send.api.mailtrap.io/api/send"
    MAIL_FROM_EMAIL: str = "noreply@iqissmexico.com"
    MAIL_FROM_NAME: str = "IQISSMexico"
    MAILTRAP_TEMPLATE_WELCOME: str = "f3a41171-c547-44d2-8da7-f4e0731707b5"
    MAILTRAP_TEMPLATE_PAYMENT_FAILED: str = "f3e97813-9c70-497e-b553-a332fc0242de"
    MAILTRAP_TEMPLATE_CANCELLED_EXPIRING: str = "18382bc8-7694-45fb-ae98-fd96df453546"
    MAILTRAP_TEMPLATE_TRIAL_EXPIRING: str = "90d1a17d-3ebe-457d-940f-0857dff7a224"
    MAILTRAP_TEMPLATE_EXPIRED: str = "03312624-4bca-4944-b63b-f3f39cc5d6b4"
    SUPPORT_WHATSAPP_PHONE: str = "5213141560219"

    # URL base del Portal / Frontend para enlaces en correos y pasarelas
    PORTAL_BASE_URL: str = "http://localhost:3001"

    # Redis (Tokens Efímeros & Cache)
    REDIS_URL: str = "redis://redis:6379/0"

    @property
    def db_url(self) -> str:
        if self.DATABASE_TYPE == "postgresql":
            return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        # SQLite por defecto
        return f"sqlite:///{self.SQLITE_DB_PATH}"

    @property
    def mercadopago_resolved_test_payer_email(self) -> str | None:
        if not self.MERCADOPAGO_TEST_PAYER_EMAIL:
            return None
        cleaned = self.MERCADOPAGO_TEST_PAYER_EMAIL.strip()
        if "@" not in cleaned:
            # Convierte TESTUSER1968490994194015693 en test_user_1968490994194015693@testuser.com
            digits = "".join(filter(str.isdigit, cleaned))
            if digits:
                return f"test_user_{digits}@testuser.com"
            return f"{cleaned.lower()}@testuser.com"
        return cleaned.lower()

    @model_validator(mode="after")
    def validate_configurations(self) -> "Settings":
        # 1. Validar credenciales de PostgreSQL si está seleccionado
        if self.DATABASE_TYPE == "postgresql":
            missing_fields = []
            for field in ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]:
                val = getattr(self, field)
                if not val or not str(val).strip():
                    missing_fields.append(field)
            if missing_fields:
                raise ValueError(
                    f"DATABASE_TYPE es 'postgresql', pero faltan o están vacías las siguientes variables obligatorias: {', '.join(missing_fields)}"
                )
                
        # 2. Validar tipo de base de datos soportado
        if self.DATABASE_TYPE not in ["sqlite", "postgresql"]:
            raise ValueError(
                f"DATABASE_TYPE '{self.DATABASE_TYPE}' no soportado. Debe ser 'sqlite' o 'postgresql'."
            )
            
        return self

settings = Settings()


def resolve_frontend_base_url(request=None, for_external_gateway: bool = False) -> str:
    """
    Resuelve dinámicamente el dominio base del frontend para URLs de retorno en pasarelas de pago.
    1. Si 'for_external_gateway' es True (ej. Mercado Pago), la pasarela exige HTTPS y un dominio público
       válido con TLD (rechaza localhost, 127.0.0.1 y testserver con 400 Bad Request).
    2. Si PORTAL_BASE_URL en variables de entorno está configurado con un dominio público (ej. túnel ngrok o staging),
       se le da prioridad directa para permitir pruebas locales con retorno hacia el túnel.
    3. Si la petición HTTP incluye un header 'origin' o 'referer' con dominio público válido, lo utiliza.
    4. Si tanto el origen como PORTAL_BASE_URL son locales (localhost) y es para pasarela externa,
       recurre a 'https://iqissmexico.com' como fallback público para evitar el error 400 de Mercado Pago.
    """
    from urllib.parse import urlparse

    configured_base = (settings.PORTAL_BASE_URL or "http://localhost:3001").strip().rstrip("/")
    p_conf = urlparse(configured_base)
    h_conf = p_conf.netloc.split(":")[0].lower() if p_conf.netloc else ""
    is_conf_public = bool(h_conf and h_conf not in ["localhost", "127.0.0.1", "testserver"] and "." in h_conf)

    # 1. Si PORTAL_BASE_URL tiene un dominio público configurado explícitamente (ej. túnel ngrok), respetarlo
    if is_conf_public:
        return f"https://{p_conf.netloc}".rstrip("/") if (for_external_gateway and p_conf.scheme == "http") else configured_base

    # 2. Si hay una petición HTTP, inspeccionar Origin o Referer
    if request is not None:
        try:
            origin = request.headers.get("origin") or request.headers.get("referer")
            if origin:
                parsed = urlparse(origin)
                scheme = parsed.scheme
                netloc = parsed.netloc
                if scheme in ["http", "https"] and netloc:
                    host = netloc.split(":")[0].lower()
                    allowed_hosts = {"localhost", "127.0.0.1", "testserver"}
                    is_allowed = (
                        host in allowed_hosts
                        or host == "iqissmexico.com"
                        or host.endswith(".iqissmexico.com")
                        or host.endswith(".ngrok-free.app")
                        or host.endswith(".trycloudflare.com")
                    )
                    if is_allowed:
                        is_origin_public = bool(host not in allowed_hosts and "." in host)
                        if is_origin_public:
                            return f"{scheme}://{netloc}".rstrip("/")
                        elif not for_external_gateway:
                            return f"{scheme}://{netloc}".rstrip("/")
        except Exception:
            pass

    # 3. Fallback público para pasarelas externas que rechazan localhost
    if for_external_gateway:
        return "https://iqissmexico.com"

    return configured_base


