"""create forum_attachments table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-11-25 11:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "forum_attachments",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("thread_id", sa.Integer(), sa.ForeignKey("forum_threads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("post_id", sa.Integer(), sa.ForeignKey("forum_posts.id", ondelete="CASCADE"), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_key", sa.String(length=500), nullable=False, unique=True),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("uploaded_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_forum_attachments_thread_id", "forum_attachments", ["thread_id"])
    op.create_index("ix_forum_attachments_post_id", "forum_attachments", ["post_id"])


def downgrade() -> None:
    op.drop_index("ix_forum_attachments_post_id", table_name="forum_attachments")
    op.drop_index("ix_forum_attachments_thread_id", table_name="forum_attachments")
    op.drop_table("forum_attachments")
