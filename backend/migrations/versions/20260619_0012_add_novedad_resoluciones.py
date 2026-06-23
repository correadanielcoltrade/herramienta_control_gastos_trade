"""Add novedad_resoluciones (solucion de novedades)

Revision ID: 20260619_0012
Revises: 20260618_0011
Create Date: 2026-06-19 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260619_0012"
down_revision = "20260618_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = settings.db_schema
    op.create_table(
        "novedad_resoluciones",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("serial_id", sa.Integer(), sa.ForeignKey(f"{schema}.serials.id"), nullable=False),
        sa.Column("cav_id", sa.Integer(), sa.ForeignKey(f"{schema}.cavs.id"), nullable=False),
        sa.Column("estado", sa.String(length=30), nullable=False, server_default="pendiente_ops"),
        sa.Column("observacion_trade", sa.Text(), nullable=False),
        sa.Column("observacion_ops", sa.Text(), nullable=True),
        sa.Column("descripcion_producto", sa.String(length=255), nullable=False),
        sa.Column("numero_guia", sa.String(length=120), nullable=False),
        sa.Column("centro_costos_cav", sa.String(length=120), nullable=False),
        sa.Column("fecha_envio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fecha_entrega_pdv", sa.DateTime(timezone=True), nullable=True),
        sa.Column("estado_entrega", sa.String(length=50), nullable=True),
        sa.Column("creado_por_id", sa.Integer(), sa.ForeignKey(f"{schema}.users.id"), nullable=False),
        sa.Column("resuelto_por_id", sa.Integer(), sa.ForeignKey(f"{schema}.users.id"), nullable=True),
        sa.Column("resuelto_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "abastecimiento_id",
            sa.Integer(),
            sa.ForeignKey(f"{schema}.abastecimientos.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        schema=schema,
    )
    op.create_index(
        "ix_novedad_resoluciones_serial_id", "novedad_resoluciones", ["serial_id"], schema=schema
    )
    op.create_index(
        "ix_novedad_resoluciones_estado", "novedad_resoluciones", ["estado"], schema=schema
    )


def downgrade() -> None:
    schema = settings.db_schema
    op.drop_index("ix_novedad_resoluciones_estado", table_name="novedad_resoluciones", schema=schema)
    op.drop_index("ix_novedad_resoluciones_serial_id", table_name="novedad_resoluciones", schema=schema)
    op.drop_table("novedad_resoluciones", schema=schema)
