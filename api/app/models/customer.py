from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    
    company_name = Column(String(150), nullable=False)
    contact_name = Column(String(100), nullable=False)
    phone = Column(String(50), nullable=True)
    tax_id = Column(String(50), nullable=True)  # RFC / Tax ID
    origin = Column(String(30), default="web_signup", nullable=False)  # web_signup, direct_sales, internal
    
    privacy_accepted_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    privacy_ip = Column(String(45), nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="customer")
    whatsapp_numbers = relationship("WhatsAppNumber", back_populates="customer", cascade="all, delete-orphan")
    webhook = relationship("CustomerWebhook", uselist=False, back_populates="customer", cascade="all, delete-orphan")
    subscriptions = relationship("CustomerSubscription", back_populates="customer", cascade="all, delete-orphan", passive_deletes=True)

