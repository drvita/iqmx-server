from app.models.base import Base
from app.models.role import Role
from app.models.user_has_role import UserHasRole
from app.models.partner import Partner
from app.models.user import User
from app.models.customer import Customer
from app.models.whatsapp_number import WhatsAppNumber
from app.models.customer_webhook import CustomerWebhook
from app.models.event import Event
from app.models.chatbot_user import ChatbotUser
from app.models.campaign import Campaign
from app.models.campaign_participation import CampaignParticipation

# Exponer todos los modelos para registro centralizado en Base.metadata
__all__ = [
    "Base", 
    "Role", 
    "UserHasRole",
    "Partner", 
    "User", 
    "Customer",
    "WhatsAppNumber",
    "CustomerWebhook",
    "Event", 
    "ChatbotUser", 
    "Campaign", 
    "CampaignParticipation"
]
