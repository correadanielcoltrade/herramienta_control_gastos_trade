"""Add regional to cavs

Revision ID: 20260513_0010
Revises: 20260513_0009
Create Date: 2026-05-13 14:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "20260513_0010"
down_revision = "20260513_0009"
branch_labels = None
depends_on = None


CAV_REGIONAL_BY_CENTRO_COSTOS: dict[str, str] = {
    "C114": "Zona Sur",
    "C159": "Zona Norte",
    "C502": "Zona Norte",
    "C501": "Zona Norte",
    "C106": "Zona Norte",
    "C116": "Zona Norte",
    "C176": "Zona Sur",
    "C102": "Zona Norte",
    "C109": "Zona Sur",
    "C153": "Zona Sur",
    "C110": "Zona Norte",
    "C111": "Zona Sur",
    "C108": "Plaza Claro",
    "C157": "Zona Sur",
    "C103": "Zona Sur",
    "C133": "Zona Norte",
    "C155": "Zona Norte",
    "C105": "Zona Sur",
    "C182": "Zona Norte",
    "C309": "Fuera de Coltrade",
    "C507": "Zona Norte",
    "C311": "Fuera de Coltrade",
    "C312": "Zona Sur",
    "C181": "Fuera de Coltrade",
    "C192": "Zona Norte",
    "C123": "Zona Norte",
    "C303": "Zona Sur",
    "C300": "Zona Sur",
    "C301": "Zona Sur",
    "C305": "Zona Sur",
    "C508": "Zona Sur",
    "C125": "Zona Norte",
    "C318": "Fuera de Coltrade",
    "C173": "Zona Norte",
    "C321": "Zona Norte",
    "C510": "Zona Norte",
    "C511": "Zona Norte",
    "C104": "Zona Sur",
    "C107": "Zona Norte",
    "C577": "Zona Sur",
    "C302": "Zona Sur",
    "C131": "Zona Sur",
    "C130": "Fuera de Coltrade",
    "C120": "Zona Norte",
    "C185": "Fuera de Coltrade",
    "C506": "Fuera de Coltrade",
    "C121": "Fuera de Coltrade",
    "C178": "Fuera de Coltrade",
    "C304": "Fuera de Coltrade",
    "C179": "Fuera de Coltrade",
    "C154": "Fuera de Coltrade",
    "C505": "Fuera de Coltrade",
    "C322": "Fuera de Coltrade",
    "C319": "Fuera de Coltrade",
    "C220": "Fuera de Coltrade",
    "C327": "Fuera de Coltrade",
    "C186": "Fuera de Coltrade",
    "C126": "Fuera de Coltrade",
    "C324": "Fuera de Coltrade",
    "C308": "Fuera de Coltrade",
    "C115": "Fuera de Coltrade",
    "C320": "Fuera de Coltrade",
    "C375": "Fuera de Coltrade",
    "C160": "Fuera de Coltrade",
    "C277": "Fuera de Coltrade",
    "C550": "Fuera de Coltrade",
    "C350": "Fuera de Coltrade",
    "C383": "Fuera de Coltrade",
    "C325": "Fuera de Coltrade",
    "C315": "Fuera de Coltrade",
    "C198": "Fuera de Coltrade",
    "C190": "Fuera de Coltrade",
    "C175": "Fuera de Coltrade",
    "C578": "Fuera de Coltrade",
    "C390": "Fuera de Coltrade",
    "C224": "Fuera de Coltrade",
    "C221": "Fuera de Coltrade",
    "C382": "Fuera de Coltrade",
    "C124": "Fuera de Coltrade",
    "C326": "Fuera de Coltrade",
    "C128": "Fuera de Coltrade",
    "C555": "Fuera de Coltrade",
    "C132": "Fuera de Coltrade",
    "C503": "Fuera de Coltrade",
    "C197": "Fuera de Coltrade",
    "C370": "Fuera de Coltrade",
    "C359": "Fuera de Coltrade",
    "C172": "Fuera de Coltrade",
    "C500": "Zona Norte",
}


def upgrade() -> None:
    op.add_column(
        "cavs",
        sa.Column("regional", sa.String(length=80), nullable=True),
        schema=settings.db_schema,
    )
    op.create_index(
        "ix_cavs_regional",
        "cavs",
        ["regional"],
        schema=settings.db_schema,
    )

    bind = op.get_bind()
    schema = settings.db_schema
    for centro_costos, regional in CAV_REGIONAL_BY_CENTRO_COSTOS.items():
        bind.execute(
            sa.text(
                f'UPDATE "{schema}".cavs '
                f"SET regional = :regional "
                f"WHERE TRIM(centro_costos) = :centro_costos"
            ),
            {"regional": regional, "centro_costos": centro_costos},
        )


def downgrade() -> None:
    op.drop_index("ix_cavs_regional", table_name="cavs", schema=settings.db_schema)
    op.drop_column("cavs", "regional", schema=settings.db_schema)
