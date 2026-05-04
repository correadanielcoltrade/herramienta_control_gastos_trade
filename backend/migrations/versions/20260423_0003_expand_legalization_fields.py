"""expand legalization fields

Revision ID: 20260423_0003
Revises: 20260422_0002
Create Date: 2026-04-23 00:30:00
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260423_0003"
down_revision = "20260422_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "legalizaciones",
        "justificacion",
        existing_type=sa.String(length=255),
        new_column_name="tipo_inventario",
        schema=settings.db_schema,
    )
    op.alter_column(
        "legalizaciones",
        "tipo_gasto",
        existing_type=sa.String(length=120),
        new_column_name="tipo_uso",
        schema=settings.db_schema,
    )

    op.add_column(
        "legalizaciones",
        sa.Column("material", sa.String(length=255), nullable=True),
        schema=settings.db_schema,
    )
    op.add_column(
        "legalizaciones",
        sa.Column("cantidad", sa.Integer(), nullable=True),
        schema=settings.db_schema,
    )
    op.add_column(
        "legalizaciones",
        sa.Column("cliente_asesor", sa.String(length=255), nullable=True),
        schema=settings.db_schema,
    )
    op.add_column(
        "legalizaciones",
        sa.Column("documento_cliente", sa.String(length=120), nullable=True),
        schema=settings.db_schema,
    )
    op.add_column(
        "legalizaciones",
        sa.Column("firma", sa.Text(), nullable=True),
        schema=settings.db_schema,
    )
    op.add_column(
        "legalizaciones",
        sa.Column("asesor_responsable", sa.String(length=255), nullable=True),
        schema=settings.db_schema,
    )

    op.execute(
        sa.text(
            f"""
            UPDATE "{settings.db_schema}".legalizaciones
            SET
                material = COALESCE(material, 'No registrado'),
                cantidad = COALESCE(cantidad, 1),
                cliente_asesor = COALESCE(cliente_asesor, 'No registrado'),
                firma = COALESCE(firma, 'data:image/png;base64,'),
                asesor_responsable = COALESCE(asesor_responsable, 'No registrado')
            """
        )
    )

    op.alter_column(
        "legalizaciones",
        "material",
        existing_type=sa.String(length=255),
        nullable=False,
        schema=settings.db_schema,
    )
    op.alter_column(
        "legalizaciones",
        "cantidad",
        existing_type=sa.Integer(),
        nullable=False,
        schema=settings.db_schema,
    )
    op.alter_column(
        "legalizaciones",
        "cliente_asesor",
        existing_type=sa.String(length=255),
        nullable=False,
        schema=settings.db_schema,
    )
    op.alter_column(
        "legalizaciones",
        "firma",
        existing_type=sa.Text(),
        nullable=False,
        schema=settings.db_schema,
    )
    op.alter_column(
        "legalizaciones",
        "asesor_responsable",
        existing_type=sa.String(length=255),
        nullable=False,
        schema=settings.db_schema,
    )


def downgrade() -> None:
    op.drop_column("legalizaciones", "asesor_responsable", schema=settings.db_schema)
    op.drop_column("legalizaciones", "firma", schema=settings.db_schema)
    op.drop_column("legalizaciones", "documento_cliente", schema=settings.db_schema)
    op.drop_column("legalizaciones", "cliente_asesor", schema=settings.db_schema)
    op.drop_column("legalizaciones", "cantidad", schema=settings.db_schema)
    op.drop_column("legalizaciones", "material", schema=settings.db_schema)

    op.alter_column(
        "legalizaciones",
        "tipo_uso",
        existing_type=sa.String(length=120),
        new_column_name="tipo_gasto",
        schema=settings.db_schema,
    )
    op.alter_column(
        "legalizaciones",
        "tipo_inventario",
        existing_type=sa.String(length=255),
        new_column_name="justificacion",
        schema=settings.db_schema,
    )
