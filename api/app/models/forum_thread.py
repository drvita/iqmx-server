from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.models.base import Base


class ForumThread(Base):
    __tablename__ = "forum_threads"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="open")  # open, in_progress, done, archived
    period_label = Column(String(50), nullable=True)
    due_at = Column(DateTime, nullable=True)
    author_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    last_post_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_forum_threads_customer_status", "customer_id", "status"),
    )

    customer = relationship("Customer")
    author = relationship("User", foreign_keys=[author_user_id])
    posts = relationship("ForumPost", back_populates="thread", cascade="all, delete-orphan")
