from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.models.base import Base

class ChatbotUser(Base):
    __tablename__ = "chatbot_users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    channel = Column(String(50), nullable=False)  # 'telegram', 'whatsapp', 'cli'
    channel_user_id = Column(String(100), nullable=False, index=True)
    phone = Column(String(50), nullable=True)  # Store the actual physical phone number if available (e.g. +521...)
    company_name = Column(String(100), nullable=False)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=True)
    request_human = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    partner = relationship("Partner")
