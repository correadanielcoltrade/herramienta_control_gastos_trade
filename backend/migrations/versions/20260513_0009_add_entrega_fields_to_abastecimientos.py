"""Add entrega fields to abastecimientos

Revision ID: 20260513_0009
Revises: 20260513_0008
Create Date: 2026-05-13 13:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260513_0009"
down_revision = "20260513_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "abastecimientos",
        sa.Column("fecha_entrega_pdv", sa.DateTime(timezone=True), nullable=True),
        schema=settings.db_schema,
    )
    op.add_column(
        "abastecimientos",
        sa.Column(
            "estado_entrega",
            sa.String(length=50),
            nullable=False,
            server_default="Pendiente de Entrega",
        ),
        schema=settings.db_schema,
    )


def downgrade() -> None:
    op.drop_column("abastecimientos", "estado_entrega", schema=settings.db_schema)
    op.drop_column("abastecimientos", "fecha_entrega_pdv", schema=settings.db_schema)
