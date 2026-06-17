from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models.base import Base

connect_args = {}
if settings.DATABASE_TYPE == "sqlite":
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.db_url,
    connect_args=connect_args
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

def get_db():
    """
    Dependency para inyectar sesiones en endpoints
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
