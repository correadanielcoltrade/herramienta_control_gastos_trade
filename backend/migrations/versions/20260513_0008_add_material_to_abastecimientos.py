"""Add material to abastecimientos

Revision ID: 20260513_0008
Revises: 20260506_0007
Create Date: 2026-05-13 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260513_0008"
down_revision = "20260506_0007"
branch_labels = None
depends_on = None


PRODUCT_MATERIAL_MAP = {
    "Mate": "7018735",
    "Privacy": "7018734",
    "Blue light": "7015640",
    "Estandar": "7015490",
}


def upgrade() -> None:
    op.add_column(
        "abastecimientos",
        sa.Column("material", sa.String(length=50), nullable=True),
        schema=settings.db_schema,
    )

    bind = op.get_bind()
    schema = settings.db_schema
    for producto, material in PRODUCT_MATERIAL_MAP.items():
        bind.execute(
            sa.text(
                f'UPDATE "{schema}".abastecimientos '
                f"SET material = :material "
                f"WHERE LOWER(TRIM(descripcion_producto)) = LOWER(:producto)"
            ),
            {"material": material, "producto": producto},
        )


def downgrade() -> None:
    op.drop_column("abastecimientos", "material", schema=settings.db_schema)
