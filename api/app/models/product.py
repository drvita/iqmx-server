from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from app.models.base import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(50), unique=True, nullable=False, index=True)  # 'crm', 'candidates', etc.
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    service_url = Column(String(255), nullable=True)  # ej. 'http://crm:3000'
    provision_endpoint = Column(String(100), default="/api/provision")
    landing_path = Column(String(100), nullable=True)  # ej. '/landingpage/crm'
    
    # Credenciales M2M con rotación nocturna
    api_secret_encrypted = Column(Text, nullable=True)
    api_secret_previous = Column(Text, nullable=True)
    last_key_rotation_at = Column(DateTime, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relación 1 a N con planes
    plans = relationship("MembershipPlan", back_populates="product", cascade="all, delete-orphan")
