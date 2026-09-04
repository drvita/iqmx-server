from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.models.base import Base

class MembershipPlan(Base):
    __tablename__ = "membership_plans"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(50), nullable=False, index=True)
    description = Column(String(255), nullable=True)
    price_mxn = Column(Numeric(10, 2), default=0.0, nullable=False)
    billing_interval = Column(String(20), default="monthly", nullable=False)  # 'monthly', 'annual'
    
    # Cuotas y configuraciones exactas asociadas a este plan
    features_payload = Column(JSON, default=dict, nullable=False)
    
    is_public = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="plans")
    subscriptions = relationship("CustomerSubscription", back_populates="plan")
