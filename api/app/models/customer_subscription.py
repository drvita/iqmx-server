from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.models.base import Base

class CustomerSubscription(Base):
    __tablename__ = "customer_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("membership_plans.id"), nullable=False, index=True)
    
    status = Column(String(30), default="active", nullable=False, index=True)  # 'trial', 'active', 'past_due', 'cancelled', 'paused'
    current_period_start = Column(DateTime, default=datetime.utcnow, nullable=False)
    current_period_end = Column(DateTime, nullable=False)
    trial_ends_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    # Identificadores externos
    mp_preapproval_id = Column(String(100), nullable=True, index=True)  # ID de suscripción en Mercado Pago
    external_tenant_id = Column(String(100), nullable=True, index=True)  # org_... del CRM o servicio correspondiente
    
    # Excepciones manuales otorgadas por el administrador
    custom_features_override = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    customer = relationship("Customer", back_populates="subscriptions")
    plan = relationship("MembershipPlan", back_populates="subscriptions")
