"""Solicitud de baja de novedades con aprobacion de OPS

Revision ID: 20260728_0014
Revises: 20260623_0013
Create Date: 2026-07-28 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260728_0014"
down_revision = "20260623_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = settings.db_schema

    # Tipo de solicitud: 'ingreso' (a abastecimiento) o 'baja' (solucionar eliminando el serial).
    # El server_default se mantiene para que las filas existentes y cualquier insert previo
    # queden como 'ingreso', que es el unico flujo que existia hasta ahora.
    op.add_column(
        "novedad_resoluciones",
        sa.Column("tipo", sa.String(length=20), nullable=False, server_default="ingreso"),
        schema=schema,
    )
    op.create_index(
        "ix_novedad_resoluciones_tipo", "novedad_resoluciones", ["tipo"], schema=schema
    )

    # Las solicitudes de baja no traen datos de abastecimiento.
    op.alter_column(
        "novedad_resoluciones",
        "descripcion_producto",
        existing_type=sa.String(length=255),
        nullable=True,
        schema=schema,
    )
    op.alter_column(
        "novedad_resoluciones",
        "numero_guia",
        existing_type=sa.String(length=120),
        nullable=True,
        schema=schema,
    )
    op.alter_column(
        "novedad_resoluciones",
        "centro_costos_cav",
        existing_type=sa.String(length=120),
        nullable=True,
        schema=schema,
    )
    op.alter_column(
        "novedad_resoluciones",
        "fecha_envio",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
        schema=schema,
    )

    # Trazabilidad del aprobador OPS en la baja ejecutada.
    op.add_column(
        "novedad_bajas",
        sa.Column("aprobado_por_id", sa.Integer(), sa.ForeignKey(f"{schema}.users.id"), nullable=True),
        schema=schema,
    )
    op.add_column(
        "novedad_bajas",
        sa.Column("aprobado_por_nombre", sa.String(length=120), nullable=True),
        schema=schema,
    )
    op.add_column(
        "novedad_bajas",
        sa.Column("observacion_ops", sa.Text(), nullable=True),
        schema=schema,
    )


def downgrade() -> None:
    schema = settings.db_schema

    op.drop_column("novedad_bajas", "observacion_ops", schema=schema)
    op.drop_column("novedad_bajas", "aprobado_por_nombre", schema=schema)
    op.drop_column("novedad_bajas", "aprobado_por_id", schema=schema)

    # Ojo: si quedaron solicitudes de baja pendientes, estas columnas tienen NULL y el
    # downgrade falla. Hay que resolverlas o borrarlas antes de revertir.
    op.alter_column(
        "novedad_resoluciones",
        "fecha_envio",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        schema=schema,
    )
    op.alter_column(
        "novedad_resoluciones",
        "centro_costos_cav",
        existing_type=sa.String(length=120),
        nullable=False,
        schema=schema,
    )
    op.alter_column(
        "novedad_resoluciones",
        "numero_guia",
        existing_type=sa.String(length=120),
        nullable=False,
        schema=schema,
    )
    op.alter_column(
        "novedad_resoluciones",
        "descripcion_producto",
        existing_type=sa.String(length=255),
        nullable=False,
        schema=schema,
    )

    op.drop_index("ix_novedad_resoluciones_tipo", table_name="novedad_resoluciones", schema=schema)
    op.drop_column("novedad_resoluciones", "tipo", schema=schema)
