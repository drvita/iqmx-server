from typing import List
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
    
    # CORS: Puede ser "*" o una lista separada por comas de orígenes
    ALLOWED_ORIGINS: str = "*"
    
    # Rate Limit: Peticiones por segundo por IP
    RATE_LIMIT_PER_SECOND: int = 35
    
    # Webhook de WhatsApp: Token de verificación enviado por Meta (Obligatorio)
    WHATSAPP_VERIFY_TOKEN: str
    
    # Clave Secreta de Meta (App Secret) para validación de firma HMAC
    META_APP_SECRET: str | None = None

    # URL interna del microservicio de API
    API_URL: str = "http://127.0.0.1:8001"

    @property
    def cors_origins(self) -> List[str]:
        if not self.ALLOWED_ORIGINS or self.ALLOWED_ORIGINS.strip() == "*":
            # Si está configurado como "*", retornamos una lista con "*"
            return ["*"]
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_configurations(self) -> "Settings":
        # 1. Validar seguridad en producción
        if self.ENVIRONMENT == "production":
            if self.ALLOWED_ORIGINS == "*":
                raise ValueError(
                    "Por seguridad, ALLOWED_ORIGINS no puede ser '*' en producción."
                )
            if self.WHATSAPP_VERIFY_TOKEN == "mi_token_de_verificacion_secreto_123":
                raise ValueError(
                    "Por seguridad, debe cambiar el valor por defecto de WHATSAPP_VERIFY_TOKEN en producción."
                )
            if not self.META_APP_SECRET or not self.META_APP_SECRET.strip():
                raise ValueError(
                    "Por seguridad, META_APP_SECRET debe estar configurada en producción para validar las firmas de WhatsApp."
                )
            if not self.API_URL or not self.API_URL.strip():
                raise ValueError(
                    "Por seguridad, API_URL debe estar configurada en producción."
                )
        return self

settings = Settings()




