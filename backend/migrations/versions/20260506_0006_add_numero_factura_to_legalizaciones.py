"""Add numero factura to legalizaciones

Revision ID: 20260506_0006
Revises: 20260506_0005
Create Date: 2026-05-06 13:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260506_0006"
down_revision = "20260506_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "legalizaciones",
        sa.Column("numero_factura", sa.String(length=120), nullable=True),
        schema=settings.db_schema,
    )


def downgrade() -> None:
    op.drop_column("legalizaciones", "numero_factura", schema=settings.db_schema)
