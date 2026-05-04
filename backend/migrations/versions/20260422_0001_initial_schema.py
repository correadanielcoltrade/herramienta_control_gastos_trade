"""initial schema

Revision ID: 20260422_0001
Revises:
Create Date: 2026-04-22 00:00:00
"""

from pathlib import Path

from alembic import op


revision = "20260422_0001"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = "Schemas_Herramienta_Trade_gastos"


def upgrade() -> None:
    schema_sql_path = Path(__file__).resolve().parents[3] / "sql" / "schema.sql"
    op.execute(schema_sql_path.read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute(f'DROP SCHEMA IF EXISTS "{SCHEMA}" CASCADE;')
