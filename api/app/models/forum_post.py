from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.models.base import Base


class ForumPost(Base):
    __tablename__ = "forum_posts"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("forum_threads.id", ondelete="CASCADE"), nullable=False)
    parent_post_id = Column(Integer, ForeignKey("forum_posts.id"), nullable=True)
    body = Column(Text, nullable=False)
    author_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_forum_posts_thread_created", "thread_id", "created_at"),
    )

    thread = relationship("ForumThread", back_populates="posts")
    parent = relationship("ForumPost", remote_side=[id])
    author = relationship("User", foreign_keys=[author_user_id])
