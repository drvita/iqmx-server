"""create_portal_models_and_events_tracking

Revision ID: 3cc3ae5bc5c3
Revises: 
Create Date: 2026-09-02 23:49:56.415980

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3cc3ae5bc5c3'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. Tabla: roles
    if "roles" not in existing_tables:
        op.create_table(
            "roles",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=50), nullable=False),
            sa.Column("description", sa.String(length=255), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("name"),
        )
        op.create_index(op.f("ix_roles_id"), "roles", ["id"], unique=False)

    # 2. Tabla: user_has_role
    if "user_has_role" not in existing_tables:
        op.create_table(
            "user_has_role",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("role_id", sa.Integer(), nullable=False),
            sa.Column("assigned_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id", "role_id"),
        )

    # 3. Tabla: customers
    if "customers" not in existing_tables:
        op.create_table(
            "customers",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("company_name", sa.String(length=255), nullable=False),
            sa.Column("contact_name", sa.String(length=255), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("phone", sa.String(length=50), nullable=True),
            sa.Column("tax_id", sa.String(length=50), nullable=True),
            sa.Column("origin", sa.String(length=50), nullable=False, server_default="web_signup"),
            sa.Column("privacy_accepted_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("email"),
            sa.UniqueConstraint("user_id"),
        )
        op.create_index(op.f("ix_customers_id"), "customers", ["id"], unique=False)

    # 4. Tabla: customer_webhooks
    if "customer_webhooks" not in existing_tables:
        op.create_table(
            "customer_webhooks",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("customer_id", sa.Integer(), nullable=False),
            sa.Column("url", sa.String(length=500), nullable=True),
            sa.Column("secret_token", sa.String(length=255), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("last_delivery_status", sa.String(length=50), nullable=True),
            sa.Column("last_delivery_code", sa.Integer(), nullable=True),
            sa.Column("last_delivery_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("customer_id"),
        )
        op.create_index(op.f("ix_customer_webhooks_id"), "customer_webhooks", ["id"], unique=False)

    # 5. Tabla: whatsapp_numbers
    if "whatsapp_numbers" not in existing_tables:
        op.create_table(
            "whatsapp_numbers",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("customer_id", sa.Integer(), nullable=False),
            sa.Column("phone_number_id", sa.String(length=50), nullable=False),
            sa.Column("waba_id", sa.String(length=50), nullable=False),
            sa.Column("display_phone_number", sa.String(length=50), nullable=True),
            sa.Column("verified_name", sa.String(length=255), nullable=True),
            sa.Column("encrypted_token", sa.Text(), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="connected"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("phone_number_id"),
        )
        op.create_index(op.f("ix_whatsapp_numbers_id"), "whatsapp_numbers", ["id"], unique=False)
        op.create_index(op.f("ix_whatsapp_numbers_phone_number_id"), "whatsapp_numbers", ["phone_number_id"], unique=True)
        op.create_index(op.f("ix_whatsapp_numbers_waba_id"), "whatsapp_numbers", ["waba_id"], unique=False)

    # 6. Actualizar tabla events: agregar columnas de tracking de entrega si no existen
    if "events" in existing_tables:
        events_cols = [c["name"] for c in inspector.get_columns("events")]
        if "customer_id" not in events_cols:
            op.add_column("events", sa.Column("customer_id", sa.Integer(), nullable=True))
            op.create_foreign_key("fk_events_customer_id", "events", "customers", ["customer_id"], ["id"], ondelete="SET NULL")
            op.create_index(op.f("ix_events_customer_id"), "events", ["customer_id"], unique=False)
        if "delivery_status" not in events_cols:
            op.add_column("events", sa.Column("delivery_status", sa.String(length=50), nullable=False, server_default="pending"))
        if "delivery_attempts" not in events_cols:
            op.add_column("events", sa.Column("delivery_attempts", sa.Integer(), nullable=False, server_default="0"))
        if "last_delivery_error" not in events_cols:
            op.add_column("events", sa.Column("last_delivery_error", sa.Text(), nullable=True))


def downgrade() -> None:
    pass
