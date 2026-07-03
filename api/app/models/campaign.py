from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from app.models.base import Base

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(50), nullable=False, default="whatsapp")  # e.g., 'whatsapp', 'mailer', 'facebook', 'google_ads'
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
