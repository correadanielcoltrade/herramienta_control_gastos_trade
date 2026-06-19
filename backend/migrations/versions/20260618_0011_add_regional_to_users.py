"""Add regional to users

Revision ID: 20260618_0011
Revises: 20260513_0010
Create Date: 2026-06-18 17:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260618_0011"
down_revision = "20260513_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("regional", sa.String(length=80), nullable=True),
        schema=settings.db_schema,
    )
    op.create_index(
        "ix_users_regional",
        "users",
        ["regional"],
        schema=settings.db_schema,
    )


def downgrade() -> None:
    op.drop_index("ix_users_regional", table_name="users", schema=settings.db_schema)
    op.drop_column("users", "regional", schema=settings.db_schema)
