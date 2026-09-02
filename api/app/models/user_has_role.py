from sqlalchemy import Column, Integer, ForeignKey, DateTime
from datetime import datetime
from app.models.base import Base

class UserHasRole(Base):
    __tablename__ = "user_has_role"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
