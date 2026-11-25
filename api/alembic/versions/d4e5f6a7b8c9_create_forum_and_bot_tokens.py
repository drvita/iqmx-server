"""create forum and bot tokens tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-11-24 20:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "forum_threads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("period_label", sa.String(length=50), nullable=True),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("author_user_id", sa.Integer(), nullable=False),
        sa.Column("last_post_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_forum_threads_id"), "forum_threads", ["id"], unique=False)
    op.create_index(op.f("ix_forum_threads_customer_id"), "forum_threads", ["customer_id"], unique=False)
    op.create_index(op.f("ix_forum_threads_last_post_at"), "forum_threads", ["last_post_at"], unique=False)
    op.create_index("ix_forum_threads_customer_status", "forum_threads", ["customer_id", "status"], unique=False)

    op.create_table(
        "forum_posts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column("parent_post_id", sa.Integer(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("author_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["thread_id"], ["forum_threads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_post_id"], ["forum_posts.id"]),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_forum_posts_id"), "forum_posts", ["id"], unique=False)
    op.create_index("ix_forum_posts_thread_created", "forum_posts", ["thread_id", "created_at"], unique=False)

    op.create_table(
        "bot_profiles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index(op.f("ix_bot_profiles_customer_id"), "bot_profiles", ["customer_id"], unique=False)

    op.create_table(
        "api_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("token_prefix", sa.String(length=20), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_api_tokens_id"), "api_tokens", ["id"], unique=False)
    op.create_index(op.f("ix_api_tokens_user_id"), "api_tokens", ["user_id"], unique=False)
    op.create_index(op.f("ix_api_tokens_token_hash"), "api_tokens", ["token_hash"], unique=True)

    # Insertar rol 'bot' de forma idempotente (compatible SQLite y PostgreSQL)
    conn = op.get_bind()
    exists = conn.execute(sa.text("SELECT id FROM roles WHERE name = :name"), {"name": "bot"}).first()
    if not exists:
        conn.execute(sa.text("INSERT INTO roles (name) VALUES (:name)"), {"name": "bot"})


def downgrade() -> None:
    op.drop_index(op.f("ix_api_tokens_token_hash"), table_name="api_tokens")
    op.drop_index(op.f("ix_api_tokens_user_id"), table_name="api_tokens")
    op.drop_index(op.f("ix_api_tokens_id"), table_name="api_tokens")
    op.drop_table("api_tokens")

    op.drop_index(op.f("ix_bot_profiles_customer_id"), table_name="bot_profiles")
    op.drop_table("bot_profiles")

    op.drop_index("ix_forum_posts_thread_created", table_name="forum_posts")
    op.drop_index(op.f("ix_forum_posts_id"), table_name="forum_posts")
    op.drop_table("forum_posts")

    op.drop_index("ix_forum_threads_customer_status", table_name="forum_threads")
    op.drop_index(op.f("ix_forum_threads_last_post_at"), table_name="forum_threads")
    op.drop_index(op.f("ix_forum_threads_customer_id"), table_name="forum_threads")
    op.drop_index(op.f("ix_forum_threads_id"), table_name="forum_threads")
    op.drop_table("forum_threads")
