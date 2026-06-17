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

    @property
    def db_url(self) -> str:
        if self.DATABASE_TYPE == "postgresql":
            return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        # SQLite por defecto
        return f"sqlite:///{self.SQLITE_DB_PATH}"

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
