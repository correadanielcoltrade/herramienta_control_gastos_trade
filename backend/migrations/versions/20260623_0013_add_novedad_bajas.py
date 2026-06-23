"""Add novedad_bajas (trazabilidad de bajas)

Revision ID: 20260623_0013
Revises: 20260619_0012
Create Date: 2026-06-23 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260623_0013"
down_revision = "20260619_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = settings.db_schema
    op.create_table(
        "novedad_bajas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("serial", sa.String(length=120), nullable=False),
        sa.Column("descripcion_producto", sa.String(length=255), nullable=True),
        sa.Column("cav_id", sa.Integer(), sa.ForeignKey(f"{schema}.cavs.id"), nullable=True),
        sa.Column("cav_nombre", sa.String(length=120), nullable=True),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey(f"{schema}.users.id"), nullable=True),
        sa.Column("usuario_nombre", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        schema=schema,
    )
    op.create_index("ix_novedad_bajas_serial", "novedad_bajas", ["serial"], schema=schema)
    op.create_index("ix_novedad_bajas_cav_id", "novedad_bajas", ["cav_id"], schema=schema)


def downgrade() -> None:
    schema = settings.db_schema
    op.drop_index("ix_novedad_bajas_cav_id", table_name="novedad_bajas", schema=schema)
    op.drop_index("ix_novedad_bajas_serial", table_name="novedad_bajas", schema=schema)
    op.drop_table("novedad_bajas", schema=schema)
