from app.models.base import Base
from app.models.role import Role
from app.models.partner import Partner
from app.models.user import User
from app.models.event import Event
from app.models.chatbot_user import ChatbotUser
from app.models.campaign import Campaign
from app.models.campaign_participation import CampaignParticipation

# Exponer todos los modelos para registro centralizado en Base.metadata
__all__ = [
    "Base", 
    "Role", 
    "Partner", 
    "User", 
    "Event", 
    "ChatbotUser", 
    "Campaign", 
    "CampaignParticipation"
]
