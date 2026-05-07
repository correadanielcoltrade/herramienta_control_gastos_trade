"""Add numero guia to abastecimientos

Revision ID: 20260506_0005
Revises: 20260430_0004
Create Date: 2026-05-06 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260506_0005"
down_revision = "20260430_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "abastecimientos",
        sa.Column("numero_guia", sa.String(length=120), nullable=True),
        schema=settings.db_schema,
    )


def downgrade() -> None:
    op.drop_column("abastecimientos", "numero_guia", schema=settings.db_schema)
