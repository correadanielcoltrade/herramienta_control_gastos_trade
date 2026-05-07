"""Add permissions system

Revision ID: 20260506_0005
Revises: 20260430_0004
Create Date: 2026-05-06 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

from app.core.config import settings

# revision identifiers, used by Alembic.
revision = '20260506_0005'
down_revision = '20260430_0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = settings.db_schema
    conn = op.get_bind()

    # Add is_read_only column to roles
    op.add_column('roles', sa.Column('is_read_only', sa.Boolean(), nullable=False, server_default='0'), schema=schema)

    # Create modules table
    conn.execute(sa.text(f'''
        CREATE TABLE "{schema}".modules (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL UNIQUE,
            description VARCHAR(255),
            icon VARCHAR(50),
            "order" INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    '''))

    # Create permissions table
    conn.execute(sa.text(f'''
        CREATE TABLE "{schema}".permissions (
            id SERIAL PRIMARY KEY,
            module_id INTEGER NOT NULL REFERENCES "{schema}".modules(id),
            action VARCHAR(50) NOT NULL,
            description VARCHAR(255),
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_module_action UNIQUE (module_id, action)
        )
    '''))

    # Create role_permissions table
    conn.execute(sa.text(f'''
        CREATE TABLE "{schema}".role_permissions (
            role_id INTEGER NOT NULL REFERENCES "{schema}".roles(id),
            permission_id INTEGER NOT NULL REFERENCES "{schema}".permissions(id),
            PRIMARY KEY (role_id, permission_id)
        )
    '''))

    # Create indexes
    conn.execute(sa.text(f'CREATE INDEX ix_modules_id ON "{schema}".modules(id)'))
    conn.execute(sa.text(f'CREATE INDEX ix_permissions_id ON "{schema}".permissions(id)'))

    # Insert modules
    conn.execute(sa.text(f'''
        INSERT INTO "{schema}".modules (name, description, icon, "order") VALUES
        ('Dashboard', 'Dashboard principal', 'BarChart3', 0),
        ('Abastecimiento', 'Módulo de abastecimiento', 'PackagePlus', 1),
        ('Recibo de Seriales', 'Recepción de seriales/inventario', 'QrCode', 2),
        ('Legalizaciones', 'Gestión de legalizaciones', 'ClipboardCheck', 3),
        ('Usuarios', 'Gestión de usuarios y accesos', 'Users', 4)
    '''))

    # Insert permissions
    conn.execute(sa.text(f'''
        INSERT INTO "{schema}".permissions (module_id, action, description) VALUES
        (1, 'read', 'Ver Dashboard'),
        (2, 'read', 'Ver Abastecimiento'),
        (2, 'create', 'Crear Abastecimiento'),
        (2, 'edit', 'Editar Abastecimiento'),
        (2, 'delete', 'Eliminar Abastecimiento'),
        (3, 'read', 'Ver Recibo de Seriales'),
        (3, 'create', 'Crear Recibo de Seriales'),
        (3, 'edit', 'Editar Recibo de Seriales'),
        (4, 'read', 'Ver Legalizaciones'),
        (4, 'create', 'Crear Legalizaciones'),
        (4, 'edit', 'Editar Legalizaciones'),
        (5, 'read', 'Ver Usuarios'),
        (5, 'create', 'Crear Usuarios'),
        (5, 'edit', 'Editar Usuarios'),
        (5, 'delete', 'Eliminar Usuarios')
    '''))

    # Update roles with read_only flag
    conn.execute(sa.text(f"UPDATE \"{schema}\".roles SET is_read_only = true WHERE name IN ('Quality', 'Trade Leader')"))

    # Assign permissions to SuperAdmin (all)
    conn.execute(sa.text(f'''
        INSERT INTO "{schema}".role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM "{schema}".roles r, "{schema}".permissions p
        WHERE r.name = 'SuperAdmin'
    '''))

    # Assign permissions to OPS
    conn.execute(sa.text(f'''
        INSERT INTO "{schema}".role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM "{schema}".roles r, "{schema}".permissions p
        WHERE r.name = 'OPS' AND p.id IN (1, 2, 3, 4, 5)
    '''))

    # Assign permissions to Quality
    conn.execute(sa.text(f'''
        INSERT INTO "{schema}".role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM "{schema}".roles r, "{schema}".permissions p
        WHERE r.name = 'Quality' AND p.id IN (1, 9)
    '''))

    # Assign permissions to Trade Leader
    conn.execute(sa.text(f'''
        INSERT INTO "{schema}".role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM "{schema}".roles r, "{schema}".permissions p
        WHERE r.name = 'Trade Leader' AND p.id IN (1, 6, 9, 12, 13, 14)
    '''))

    # Assign permissions to Asesor
    conn.execute(sa.text(f'''
        INSERT INTO "{schema}".role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM "{schema}".roles r, "{schema}".permissions p
        WHERE r.name = 'Asesor' AND p.id IN (1, 6, 7, 9, 10)
    '''))

    # Assign permissions to Supernumerario
    conn.execute(sa.text(f'''
        INSERT INTO "{schema}".role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM "{schema}".roles r, "{schema}".permissions p
        WHERE r.name = 'Supernumerario' AND p.id IN (1, 6, 7, 9, 10)
    '''))


def downgrade() -> None:
    schema = settings.db_schema
    conn = op.get_bind()

    conn.execute(sa.text(f'DROP TABLE IF EXISTS "{schema}".role_permissions CASCADE'))
    conn.execute(sa.text(f'DROP TABLE IF EXISTS "{schema}".permissions CASCADE'))
    conn.execute(sa.text(f'DROP TABLE IF EXISTS "{schema}".modules CASCADE'))
    conn.execute(sa.text(f'ALTER TABLE "{schema}".roles DROP COLUMN IF EXISTS is_read_only'))
