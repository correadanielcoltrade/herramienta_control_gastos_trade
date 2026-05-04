INSERT INTO "Schemas_Herramienta_Trade_gastos".roles (name, description)
VALUES
    ('SuperAdmin', 'Acceso global y administracion total'),
    ('OPS', 'Operacion y seguimiento logistico'),
    ('Quality', 'Control de calidad y validacion'),
    ('Trade', 'Gestion operativa del negocio'),
    ('Asesor', 'Atencion y legalizacion en punto'),
    ('Supernumerario', 'Cobertura multi CAV')
ON CONFLICT (name) DO NOTHING;

INSERT INTO "Schemas_Herramienta_Trade_gastos".cavs (nombre_cav, centro_costos)
VALUES
    ('CAV Norte', 'CC-100'),
    ('CAV Centro', 'CC-200'),
    ('CAV Sur', 'CC-300')
ON CONFLICT (nombre_cav) DO NOTHING;

-- Usuario administrador sugerido:
-- 1. Genera el hash bcrypt:
--    python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('Admin123!'))"
-- 2. Reemplaza el valor de password_hash y ejecuta este bloque:
--
-- INSERT INTO "Schemas_Herramienta_Trade_gastos".users (nombre_usuario, correo, password_hash, role_id, cav_id, is_active)
-- SELECT
--     'Administrador MKP',
--     'admin@mkp.local',
--     '$2b$12$replace-me',
--     r.id,
--     NULL,
--     TRUE
-- FROM "Schemas_Herramienta_Trade_gastos".roles r
-- WHERE r.name = 'SuperAdmin'
-- ON CONFLICT DO NOTHING;

