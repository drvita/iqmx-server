from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from datetime import datetime
from app.models.base import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    wa_id = Column(String(50), nullable=True, index=True)
    message_id = Column(String(255), nullable=True, index=True)
    message_body = Column(Text, nullable=True)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
