from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from app.models.base import Base

class CampaignParticipation(Base):
    __tablename__ = "campaign_participations"

    id = Column(Integer, primary_key=True, index=True)
    chatbot_user_id = Column(Integer, ForeignKey("chatbot_users.id"), nullable=False)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    extra_data = Column(JSON, nullable=True)  # custom payload containing campaign-specific form answers
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    chatbot_user = relationship("ChatbotUser")
    campaign = relationship("Campaign")
