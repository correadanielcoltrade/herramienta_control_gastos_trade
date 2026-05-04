"""unique reception per serial

Revision ID: 20260430_0004
Revises: 20260423_0003
Create Date: 2026-04-30 00:40:00
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260430_0004"
down_revision = "20260423_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM (
                        SELECT serial_id
                        FROM "{settings.db_schema}".recepciones
                        GROUP BY serial_id
                        HAVING COUNT(*) > 1
                    ) AS duplicados
                ) THEN
                    RAISE EXCEPTION 'Existen seriales con mas de un recibo. Depura esos registros antes de crear el indice unico.';
                END IF;
            END $$;
            """
        )
    )
    op.execute(
        sa.text(
            f"""
            CREATE UNIQUE INDEX IF NOT EXISTS ux_recepciones_serial_id
            ON "{settings.db_schema}".recepciones (serial_id)
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            f'DROP INDEX IF EXISTS "{settings.db_schema}".ux_recepciones_serial_id'
        )
    )
