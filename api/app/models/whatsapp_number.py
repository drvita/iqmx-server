from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class WhatsAppNumber(Base):
    __tablename__ = "whatsapp_numbers"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    
    phone_number_id = Column(String(100), unique=True, index=True, nullable=False)
    waba_id = Column(String(100), index=True, nullable=False)
    display_phone_number = Column(String(50), nullable=True)
    verified_name = Column(String(150), nullable=True)
    
    # Token permanente de WhatsApp cifrado con AES-256-GCM
    encrypted_token = Column(Text, nullable=False)
    
    status = Column(String(30), default="connected", nullable=False)  # connected, reconnect_required, disconnected
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    customer = relationship("Customer", back_populates="whatsapp_numbers")
