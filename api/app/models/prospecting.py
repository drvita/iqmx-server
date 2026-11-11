from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship
from app.models.base import Base


class ProspectingCampaign(Base):
    __tablename__ = "prospecting_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)
    country = Column(String(60), nullable=False, default="México")
    state_code = Column(String(10), nullable=False, default="06")  # 06 = Colima
    state_name = Column(String(80), nullable=False, default="Colima")
    municipality_code = Column(String(10), nullable=False, default="0")
    municipality_name = Column(String(100), nullable=False, default="Todo el estado")
    scian_codes = Column(String(200), nullable=False, default="812110")
    search_keywords = Column(String(255), nullable=False, default="estetica,barberia,salon de belleza,peluqueria")
    stratum_filter = Column(String(100), nullable=False, default="0 a 30 personas")
    is_active = Column(Boolean, default=True, nullable=False)
    last_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    runs = relationship("ProspectingRun", back_populates="campaign", cascade="all, delete-orphan")
    businesses = relationship("ProspectingBusiness", back_populates="campaign")


class ProspectingRun(Base):
    __tablename__ = "prospecting_runs"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("prospecting_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    run_type = Column(String(30), nullable=False, default="discovery")
    status = Column(String(30), nullable=False, default="running")
    total_found = Column(Integer, nullable=False, default=0)
    new_added = Column(Integer, nullable=False, default=0)
    updated_count = Column(Integer, nullable=False, default=0)
    enriched_count = Column(Integer, nullable=False, default=0)
    error_log = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)

    campaign = relationship("ProspectingCampaign", back_populates="runs")


class ProspectingBusiness(Base):
    __tablename__ = "prospecting_businesses"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("prospecting_campaigns.id", ondelete="SET NULL"), nullable=True, index=True)
    denue_id = Column(String(64), nullable=False, unique=True, index=True)
    clee = Column(String(80), nullable=True, index=True)

    name = Column(String(255), nullable=False)
    razon_social = Column(String(255), nullable=True)
    scian_code = Column(String(30), nullable=True)
    scian_activity = Column(String(255), nullable=True, index=True)
    stratum = Column(String(80), nullable=True)

    phone = Column(String(60), nullable=True)
    email = Column(String(160), nullable=True)
    website_url = Column(String(500), nullable=True)

    street = Column(String(200), nullable=True)
    ext_number = Column(String(40), nullable=True)
    int_number = Column(String(40), nullable=True)
    neighborhood = Column(String(160), nullable=True)
    postal_code = Column(String(20), nullable=True)
    locality = Column(String(120), nullable=True)
    municipality = Column(String(120), nullable=True, index=True)
    state = Column(String(80), nullable=True, index=True)
    latitude = Column(String(40), nullable=True)
    longitude = Column(String(40), nullable=True)

    # Estado del embudo
    # 'discovered' -> 'ready_for_llm' -> 'qualified' | 'disqualified' -> 'contacted'
    status = Column(String(40), nullable=False, default="discovered", index=True)
    disqualification_reason = Column(Text, nullable=True)

    # Scores bimodales: DENUE (0-50), Digital (0-50) y computado total_score (0-100)
    denue_score = Column(Integer, nullable=False, default=0, index=True)
    digital_score = Column(Integer, nullable=False, default=0, index=True)

    @hybrid_property
    def total_score(self) -> int:
        return (self.denue_score or 0) + (self.digital_score or 0)

    @total_score.expression
    def total_score(cls):
        from sqlalchemy import func
        return func.coalesce(cls.denue_score, 0) + func.coalesce(cls.digital_score, 0)

    # Canal prioritario definido por el evaluador
    # 'whatsapp' | 'email' | 'physical_visit' | 'none'
    contact_channel = Column(String(40), nullable=True, default="none", index=True)

    # Rastreo de envíos y eventos de Mailtrap
    email_sent_at = Column(DateTime, nullable=True)
    email_message_id = Column(String(120), nullable=True, index=True)
    email_delivery_status = Column(String(40), nullable=True, default="none", index=True)  # 'none' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced'
    email_delivered_at = Column(DateTime, nullable=True)
    email_opened_at = Column(DateTime, nullable=True)
    email_clicked_at = Column(DateTime, nullable=True)

    has_working_website = Column(Boolean, nullable=True)
    has_ssl = Column(Boolean, nullable=True)
    has_whatsapp_link = Column(Boolean, nullable=True)
    has_online_booking = Column(Boolean, nullable=True)
    booking_provider = Column(String(80), nullable=True)
    social_links = Column(JSON, nullable=True)
    digital_signals = Column(JSON, nullable=True)
    llm_analysis = Column(JSON, nullable=True)

    last_discovered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_scraped_at = Column(DateTime, nullable=True)
    last_evaluated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    campaign = relationship("ProspectingCampaign", back_populates="businesses")
    sources = relationship("ProspectingSource", back_populates="business", cascade="all, delete-orphan")


class ProspectingSource(Base):
    __tablename__ = "prospecting_sources"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("prospecting_businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type = Column(String(40), nullable=False)  # 'denue' | 'website_scrape' | 'public_search' | 'llm_eval'
    source_url = Column(String(500), nullable=True)
    confidence_level = Column(String(30), nullable=False, default="confirmed")
    http_status = Column(Integer, nullable=True)
    summary = Column(String(500), nullable=True)
    extracted_data = Column(JSON, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    business = relationship("ProspectingBusiness", back_populates="sources")
