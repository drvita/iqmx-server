"""manual customers nullable password_hash and phone_normalized

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-11-25 15:05:00.000000

"""
from typing import Optional, Sequence, Union
import re
import secrets

from alembic import op
import sqlalchemy as sa


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _normalize_phone_backfill(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if len(digits) < 7:
        return None
    if len(digits) == 13 and digits.startswith("521"):
        return digits[-10:]
    if len(digits) == 12 and digits.startswith("52"):
        return digits[-10:]
    if len(digits) > 30:
        return digits[:30]
    return digits


def upgrade() -> None:
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=True,
    )
    op.add_column(
        "customers",
        sa.Column("phone_normalized", sa.String(length=30), nullable=True),
    )
    op.create_index(
        "ix_customers_phone_normalized",
        "customers",
        ["phone_normalized"],
    )

    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, phone FROM customers WHERE phone IS NOT NULL")
    ).fetchall()
    for row in rows:
        norm = _normalize_phone_backfill(row.phone)
        if norm:
            bind.execute(
                sa.text(
                    "UPDATE customers SET phone_normalized = :norm WHERE id = :cid"
                ),
                {"norm": norm, "cid": row.id},
            )


def downgrade() -> None:
    op.drop_index("ix_customers_phone_normalized", table_name="customers")
    op.drop_column("customers", "phone_normalized")

    bind = op.get_bind()
    placeholder_hash = f"disabled_downgrade_{secrets.token_hex(16)}"
    bind.execute(
        sa.text(
            "UPDATE users SET password_hash = :ph WHERE password_hash IS NULL"
        ),
        {"ph": placeholder_hash},
    )
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=False,
    )
