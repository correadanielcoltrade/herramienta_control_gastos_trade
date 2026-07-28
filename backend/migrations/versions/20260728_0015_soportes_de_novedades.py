"""Soportes adjuntos de novedades

Revision ID: 20260728_0015
Revises: 20260728_0014
Create Date: 2026-07-28 16:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260728_0015"
down_revision = "20260728_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = settings.db_schema

    op.create_table(
        "novedad_soportes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre_archivo", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("tamano_bytes", sa.Integer(), nullable=False),
        sa.Column("contenido", sa.LargeBinary(), nullable=False),
        sa.Column("subido_por_id", sa.Integer(), sa.ForeignKey(f"{schema}.users.id"), nullable=True),
        sa.Column("subido_por_nombre", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        schema=schema,
    )

    op.add_column(
        "novedad_resoluciones",
        sa.Column(
            "soporte_id",
            sa.Integer(),
            sa.ForeignKey(f"{schema}.novedad_soportes.id"),
            nullable=True,
        ),
        schema=schema,
    )
    op.add_column(
        "novedad_bajas",
        sa.Column(
            "soporte_id",
            sa.Integer(),
            sa.ForeignKey(f"{schema}.novedad_soportes.id"),
            nullable=True,
        ),
        schema=schema,
    )


def downgrade() -> None:
    schema = settings.db_schema

    op.drop_column("novedad_bajas", "soporte_id", schema=schema)
    op.drop_column("novedad_resoluciones", "soporte_id", schema=schema)
    op.drop_table("novedad_soportes", schema=schema)
