-- Script to setup permissions system
-- Run this directly in PostgreSQL with: psql -U user -d database -f setup_permissions.sql

BEGIN;

-- 1. Add is_read_only column to roles if it doesn't exist
ALTER TABLE "Schemas_Herramienta_Trade_gastos".roles
ADD COLUMN IF NOT EXISTS is_read_only BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create modules table
CREATE TABLE IF NOT EXISTS "Schemas_Herramienta_Trade_gastos".modules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    icon VARCHAR(50),
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create permissions table
CREATE TABLE IF NOT EXISTS "Schemas_Herramienta_Trade_gastos".permissions (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".modules(id),
    action VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_module_action UNIQUE (module_id, action)
);

-- 4. Create role_permissions table
CREATE TABLE IF NOT EXISTS "Schemas_Herramienta_Trade_gastos".role_permissions (
    role_id INTEGER NOT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".roles(id),
    permission_id INTEGER NOT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS ix_modules_id ON "Schemas_Herramienta_Trade_gastos".modules(id);
CREATE INDEX IF NOT EXISTS ix_permissions_id ON "Schemas_Herramienta_Trade_gastos".permissions(id);

-- 6. Insert modules (if not already inserted)
INSERT INTO "Schemas_Herramienta_Trade_gastos".modules (name, description, icon, "order") VALUES
    ('Dashboard', 'Dashboard principal', 'BarChart3', 0),
    ('Abastecimiento', 'Módulo de abastecimiento', 'PackagePlus', 1),
    ('Recibo de Seriales', 'Recepción de seriales/inventario', 'QrCode', 2),
    ('Legalizaciones', 'Gestión de legalizaciones', 'ClipboardCheck', 3),
    ('Usuarios', 'Gestión de usuarios y accesos', 'Users', 4)
ON CONFLICT (name) DO NOTHING;

-- 7. Insert permissions (if not already inserted)
INSERT INTO "Schemas_Herramienta_Trade_gastos".permissions (module_id, action, description) VALUES
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
ON CONFLICT (module_id, action) DO NOTHING;

-- 8. Update roles with read_only flag
UPDATE "Schemas_Herramienta_Trade_gastos".roles SET is_read_only = true WHERE name IN ('Quality', 'Trade Leader');

-- 9. Assign permissions to SuperAdmin (all)
INSERT INTO "Schemas_Herramienta_Trade_gastos".role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM "Schemas_Herramienta_Trade_gastos".roles r, "Schemas_Herramienta_Trade_gastos".permissions p
WHERE r.name = 'SuperAdmin'
ON CONFLICT DO NOTHING;

-- 10. Assign permissions to OPS
INSERT INTO "Schemas_Herramienta_Trade_gastos".role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM "Schemas_Herramienta_Trade_gastos".roles r, "Schemas_Herramienta_Trade_gastos".permissions p
WHERE r.name = 'OPS' AND p.id IN (1, 2, 3, 4, 5)
ON CONFLICT DO NOTHING;

-- 11. Assign permissions to Quality
INSERT INTO "Schemas_Herramienta_Trade_gastos".role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM "Schemas_Herramienta_Trade_gastos".roles r, "Schemas_Herramienta_Trade_gastos".permissions p
WHERE r.name = 'Quality' AND p.id IN (1, 9)
ON CONFLICT DO NOTHING;

-- 12. Assign permissions to Trade Leader
INSERT INTO "Schemas_Herramienta_Trade_gastos".role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM "Schemas_Herramienta_Trade_gastos".roles r, "Schemas_Herramienta_Trade_gastos".permissions p
WHERE r.name = 'Trade Leader' AND p.id IN (1, 6, 9, 12, 13, 14)
ON CONFLICT DO NOTHING;

-- 13. Assign permissions to Asesor
INSERT INTO "Schemas_Herramienta_Trade_gastos".role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM "Schemas_Herramienta_Trade_gastos".roles r, "Schemas_Herramienta_Trade_gastos".permissions p
WHERE r.name = 'Asesor' AND p.id IN (1, 6, 7, 9, 10)
ON CONFLICT DO NOTHING;

-- 14. Assign permissions to Supernumerario
INSERT INTO "Schemas_Herramienta_Trade_gastos".role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM "Schemas_Herramienta_Trade_gastos".roles r, "Schemas_Herramienta_Trade_gastos".permissions p
WHERE r.name = 'Supernumerario' AND p.id IN (1, 6, 7, 9, 10)
ON CONFLICT DO NOTHING;

COMMIT;

-- Verify the setup
SELECT 'Modules:' as info;
SELECT * FROM "Schemas_Herramienta_Trade_gastos".modules;

SELECT 'Permissions:' as info;
SELECT * FROM "Schemas_Herramienta_Trade_gastos".permissions;

SELECT 'Role Permissions:' as info;
SELECT r.name as role_name, COUNT(p.id) as permission_count
FROM "Schemas_Herramienta_Trade_gastos".roles r
LEFT JOIN "Schemas_Herramienta_Trade_gastos".role_permissions rp ON r.id = rp.role_id
LEFT JOIN "Schemas_Herramienta_Trade_gastos".permissions p ON rp.permission_id = p.id
GROUP BY r.name
ORDER BY r.name;
