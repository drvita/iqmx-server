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
