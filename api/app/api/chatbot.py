from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.db.database import get_db
from app.models import ChatbotUser, Partner, Campaign, CampaignParticipation

router = APIRouter(prefix="/api", tags=["chatbot"])

# Pydantic Schemas
class ChatbotUserResponse(BaseModel):
    id: int
    name: str
    channel: str
    channel_user_id: str
    phone: Optional[str]
    company_name: str
    partner_id: Optional[int]
    request_human: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ChatbotUserCreate(BaseModel):
    name: str
    channel: str
    channel_user_id: str
    phone: Optional[str] = None
    company_name: str

class UserEscalateRequest(BaseModel):
    channel: str
    channel_user_id: str

class PartnerValidationResponse(BaseModel):
    is_partner: bool
    partner_name: Optional[str]

class CampaignResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    type: str
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    active: bool

    class Config:
        from_attributes = True

class CampaignParticipationCreate(BaseModel):
    channel: str
    channel_user_id: str
    campaign_id: int
    extra_data: Optional[dict] = None

class CampaignParticipationResponse(BaseModel):
    id: int
    chatbot_user_id: int
    campaign_id: int
    extra_data: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True

# Route definitions
@router.get("/users/by-channel", response_model=Optional[ChatbotUserResponse])
def get_user_by_channel(channel: str, channel_user_id: str, db: Session = Depends(get_db)):
    """Busca un usuario del chatbot por canal e identificador de canal."""
    user = db.query(ChatbotUser).filter(
        ChatbotUser.channel == channel,
        ChatbotUser.channel_user_id == channel_user_id
    ).first()
    return user

@router.post("/users", response_model=ChatbotUserResponse, status_code=status.HTTP_201_CREATED)
def create_chatbot_user(user_data: ChatbotUserCreate, db: Session = Depends(get_db)):
    """Registra o actualiza los datos de un usuario de canal. 
    Busca asociarlo con un socio estratégico si el nombre de la empresa coincide,
    independientemente de si el socio está activo o inactivo en este momento.
    """
    # Check if user already exists in this channel
    existing_user = db.query(ChatbotUser).filter(
        ChatbotUser.channel == user_data.channel,
        ChatbotUser.channel_user_id == user_data.channel_user_id
    ).first()
    
    # Check case-insensitive match for Partner (active or inactive)
    partner = db.query(Partner).filter(
        Partner.name.ilike(user_data.company_name.strip())
    ).first()
    partner_id = partner.id if partner else None

    if existing_user:
        existing_user.name = user_data.name
        existing_user.company_name = user_data.company_name
        existing_user.partner_id = partner_id
        if user_data.phone:
            existing_user.phone = user_data.phone
        db.commit()
        db.refresh(existing_user)
        return existing_user

    # If it is a new user
    new_user = ChatbotUser(
        name=user_data.name,
        channel=user_data.channel,
        channel_user_id=user_data.channel_user_id,
        phone=user_data.phone,
        company_name=user_data.company_name,
        partner_id=partner_id,
        request_human=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/users/escalate", status_code=status.HTTP_200_OK)
def escalate_chatbot_user(req: UserEscalateRequest, db: Session = Depends(get_db)):
    """Marca a un usuario para atención humana, desactivando respuestas automáticas."""
    user = db.query(ChatbotUser).filter(
        ChatbotUser.channel == req.channel,
        ChatbotUser.channel_user_id == req.channel_user_id
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot user not found for this channel and user ID."
        )
    user.request_human = True
    db.commit()
    return {"status": "success", "message": "User successfully escalated to human support."}

@router.get("/partners/validate", response_model=PartnerValidationResponse)
def validate_partner(company: str, db: Session = Depends(get_db)):
    """Verifica si una empresa es un socio activo registrado."""
    partner = db.query(Partner).filter(
        Partner.name.ilike(company.strip())
    ).first()
    
    if partner:
        # Check active status dynamically
        return {"is_partner": partner.active, "partner_name": partner.name}
    return {"is_partner": False, "partner_name": None}

@router.get("/campaigns", response_model=List[CampaignResponse])
def get_campaigns(db: Session = Depends(get_db)):
    """Lista las campañas de marketing y soporte que se encuentran activas y vigentes."""
    now = datetime.utcnow()
    campaigns = db.query(Campaign).filter(
        Campaign.active == True,
        (Campaign.start_date == None) | (Campaign.start_date <= now),
        (Campaign.end_date == None) | (Campaign.end_date >= now)
    ).all()
    return campaigns

@router.post("/campaigns/participate", response_model=CampaignParticipationResponse, status_code=status.HTTP_201_CREATED)
def register_campaign_participation(req: CampaignParticipationCreate, db: Session = Depends(get_db)):
    """Registra la participación de un usuario del chatbot en una campaña activa y vigente."""
    # 1. Fetch user by channel and user ID
    user = db.query(ChatbotUser).filter(
        ChatbotUser.channel == req.channel,
        ChatbotUser.channel_user_id == req.channel_user_id
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not registered. Please register the chatbot user before participating in campaigns."
        )
        
    # 2. Fetch campaign
    campaign = db.query(Campaign).filter(Campaign.id == req.campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found."
        )
        
    # 3. Verify campaign is active and valid (not expired)
    now = datetime.utcnow()
    is_valid = (
        campaign.active and
        (campaign.start_date is None or campaign.start_date <= now) and
        (campaign.end_date is None or campaign.end_date >= now)
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign is currently inactive or expired."
        )
        
    # 4. Check if participation already exists
    participation = db.query(CampaignParticipation).filter(
        CampaignParticipation.chatbot_user_id == user.id,
        CampaignParticipation.campaign_id == campaign.id
    ).first()
    
    if participation:
        participation.extra_data = req.extra_data
        db.commit()
        db.refresh(participation)
        return participation
        
    # Create new participation
    new_participation = CampaignParticipation(
        chatbot_user_id=user.id,
        campaign_id=campaign.id,
        extra_data=req.extra_data
    )
    db.add(new_participation)
    db.commit()
    db.refresh(new_participation)
    return new_participation

@router.get("/campaigns/participation", response_model=Optional[CampaignParticipationResponse])
def get_campaign_participation(channel: str, channel_user_id: str, campaign_id: int, db: Session = Depends(get_db)):
    """Verifica si un usuario del chatbot ya se encuentra registrado en una campaña."""
    user = db.query(ChatbotUser).filter(
        ChatbotUser.channel == channel,
        ChatbotUser.channel_user_id == channel_user_id
    ).first()
    if not user:
        return None
        
    participation = db.query(CampaignParticipation).filter(
        CampaignParticipation.chatbot_user_id == user.id,
        CampaignParticipation.campaign_id == campaign_id
    ).first()
    return participation
