from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey
from datetime import datetime
from app.models.base import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    wa_id = Column(String(50), nullable=True, index=True)
    message_id = Column(String(255), nullable=True, index=True)
    message_body = Column(Text, nullable=True)
    payload = Column(JSON, nullable=False)
    
    # Tracking de despacho hacia CRM de cliente
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    delivery_status = Column(String(30), default="pending", nullable=False)  # pending, delivered, sent, failed
    delivery_attempts = Column(Integer, default=0, nullable=False)
    last_delivery_error = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
