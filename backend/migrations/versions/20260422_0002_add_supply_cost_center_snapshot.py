"""add cost center snapshot to supplies

Revision ID: 20260422_0002
Revises: 20260422_0001
Create Date: 2026-04-22 00:20:00
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260422_0002"
down_revision = "20260422_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "abastecimientos",
        sa.Column("centro_costos_cav", sa.String(length=120), nullable=True),
        schema=settings.db_schema,
    )
    op.execute(
        sa.text(
            f"""
            UPDATE "{settings.db_schema}".abastecimientos AS abastecimientos
            SET centro_costos_cav = cavs.centro_costos
            FROM "{settings.db_schema}".cavs AS cavs
            WHERE cavs.id = abastecimientos.cav_id
            """
        )
    )
    op.alter_column(
        "abastecimientos",
        "centro_costos_cav",
        existing_type=sa.String(length=120),
        nullable=False,
        schema=settings.db_schema,
    )


def downgrade() -> None:
    op.drop_column("abastecimientos", "centro_costos_cav", schema=settings.db_schema)
