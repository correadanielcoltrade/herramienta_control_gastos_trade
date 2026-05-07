"""Add password reset tokens table

Revision ID: 20260506_0007
Revises: 20260506_0006
Create Date: 2026-05-06 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260506_0007"
down_revision = "20260506_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["user_id"], ["Schemas_Herramienta_Trade_gastos.users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_password_reset_tokens_user_id", "user_id"),
        sa.Index("ix_password_reset_tokens_token", "token"),
        schema="Schemas_Herramienta_Trade_gastos",
    )


def downgrade() -> None:
    op.drop_table("password_reset_tokens", schema="Schemas_Herramienta_Trade_gastos")
