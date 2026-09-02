from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class CustomerWebhook(Base):
    __tablename__ = "customer_webhooks"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    
    url = Column(String(500), nullable=True)  # URL de destino del CRM del cliente (HTTPS)
    secret_token = Column(String(128), nullable=False)  # Clave secreta para firmar con HMAC-SHA256
    is_active = Column(Boolean, default=True, nullable=False)
    
    last_delivery_status = Column(String(50), nullable=True)  # delivered, sent, failed
    last_delivery_code = Column(Integer, nullable=True)  # HTTP status code (200, 404, 500, etc.)
    last_delivery_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    customer = relationship("Customer", back_populates="webhook")
