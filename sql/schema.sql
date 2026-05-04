CREATE SCHEMA IF NOT EXISTS "Schemas_Herramienta_Trade_gastos";

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'serial_status'
          AND n.nspname = 'Schemas_Herramienta_Trade_gastos'
    ) THEN
        CREATE TYPE "Schemas_Herramienta_Trade_gastos".serial_status AS ENUM (
            'enviado',
            'recibido',
            'disponible',
            'gastado',
            'legalizado',
            'duplicado',
            'pendiente'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'movement_type'
          AND n.nspname = 'Schemas_Herramienta_Trade_gastos'
    ) THEN
        CREATE TYPE "Schemas_Herramienta_Trade_gastos".movement_type AS ENUM (
            'abastecimiento',
            'recepcion',
            'disponibilidad',
            'legalizacion',
            'duplicado',
            'ajuste'
        );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION "Schemas_Herramienta_Trade_gastos".set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS "Schemas_Herramienta_Trade_gastos".roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Schemas_Herramienta_Trade_gastos".cavs (
    id BIGSERIAL PRIMARY KEY,
    nombre_cav VARCHAR(120) NOT NULL UNIQUE,
    centro_costos VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Schemas_Herramienta_Trade_gastos".users (
    id BIGSERIAL PRIMARY KEY,
    nombre_usuario VARCHAR(120) NOT NULL,
    correo VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id BIGINT NOT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".roles(id),
    cav_id BIGINT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".cavs(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_correo_lower
    ON "Schemas_Herramienta_Trade_gastos".users (LOWER(correo));

CREATE TABLE IF NOT EXISTS "Schemas_Herramienta_Trade_gastos".serials (
    id BIGSERIAL PRIMARY KEY,
    serial VARCHAR(120) NOT NULL,
    descripcion_producto VARCHAR(255),
    cav_id BIGINT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".cavs(id) ON DELETE SET NULL,
    current_status "Schemas_Herramienta_Trade_gastos".serial_status NOT NULL,
    last_movement_at TIMESTAMPTZ NULL,
    created_by_id BIGINT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_serials_serial
    ON "Schemas_Herramienta_Trade_gastos".serials (serial);

CREATE INDEX IF NOT EXISTS ix_serials_status_cav
    ON "Schemas_Herramienta_Trade_gastos".serials (current_status, cav_id);

CREATE TABLE IF NOT EXISTS "Schemas_Herramienta_Trade_gastos".serial_movements (
    id BIGSERIAL PRIMARY KEY,
    serial_id BIGINT NOT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".serials(id) ON DELETE CASCADE,
    movement_type "Schemas_Herramienta_Trade_gastos".movement_type NOT NULL,
    previous_status "Schemas_Herramienta_Trade_gastos".serial_status NULL,
    new_status "Schemas_Herramienta_Trade_gastos".serial_status NOT NULL,
    source_table VARCHAR(60) NOT NULL,
    source_id BIGINT NULL,
    notes TEXT NULL,
    cav_id BIGINT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".cavs(id) ON DELETE SET NULL,
    user_id BIGINT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_serial_movements_serial_id
    ON "Schemas_Herramienta_Trade_gastos".serial_movements (serial_id, created_at DESC);

CREATE TABLE IF NOT EXISTS "Schemas_Herramienta_Trade_gastos".abastecimientos (
    id BIGSERIAL PRIMARY KEY,
    serial_id BIGINT NOT NULL UNIQUE REFERENCES "Schemas_Herramienta_Trade_gastos".serials(id) ON DELETE CASCADE,
    descripcion_producto VARCHAR(255) NOT NULL,
    cav_id BIGINT NOT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".cavs(id),
    fecha_envio TIMESTAMPTZ NOT NULL,
    usuario_id BIGINT NOT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_abastecimientos_fecha_cav
    ON "Schemas_Herramienta_Trade_gastos".abastecimientos (fecha_envio, cav_id);

CREATE TABLE IF NOT EXISTS "Schemas_Herramienta_Trade_gastos".recepciones (
    id BIGSERIAL PRIMARY KEY,
    serial_id BIGINT NOT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".serials(id) ON DELETE CASCADE,
    cav_id BIGINT NOT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".cavs(id),
    fecha TIMESTAMPTZ NOT NULL,
    usuario_id BIGINT NOT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_recepciones_serial_id
    ON "Schemas_Herramienta_Trade_gastos".recepciones (serial_id);

CREATE INDEX IF NOT EXISTS ix_recepciones_fecha_cav
    ON "Schemas_Herramienta_Trade_gastos".recepciones (fecha, cav_id);

CREATE TABLE IF NOT EXISTS "Schemas_Herramienta_Trade_gastos".legalizaciones (
    id BIGSERIAL PRIMARY KEY,
    serial_id BIGINT NOT NULL UNIQUE REFERENCES "Schemas_Herramienta_Trade_gastos".serials(id) ON DELETE CASCADE,
    tipo_inventario VARCHAR(255) NOT NULL,
    tipo_uso VARCHAR(120) NOT NULL,
    material VARCHAR(255) NOT NULL,
    cantidad INTEGER NOT NULL,
    cliente_asesor VARCHAR(255) NOT NULL,
    documento_cliente VARCHAR(120) NULL,
    firma TEXT NOT NULL,
    asesor_responsable VARCHAR(255) NOT NULL,
    observaciones TEXT NULL,
    fecha TIMESTAMPTZ NOT NULL,
    usuario_id BIGINT NOT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_legalizaciones_fecha_usuario
    ON "Schemas_Herramienta_Trade_gastos".legalizaciones (fecha, usuario_id);

CREATE TABLE IF NOT EXISTS "Schemas_Herramienta_Trade_gastos".audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NULL REFERENCES "Schemas_Herramienta_Trade_gastos".users(id) ON DELETE SET NULL,
    action VARCHAR(120) NOT NULL,
    entity VARCHAR(120) NOT NULL,
    entity_id BIGINT NULL,
    payload JSONB NULL,
    ip_address VARCHAR(64) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_action_entity
    ON "Schemas_Herramienta_Trade_gastos".audit_logs (action, entity, created_at DESC);

DROP TRIGGER IF EXISTS trg_roles_updated_at ON "Schemas_Herramienta_Trade_gastos".roles;
CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON "Schemas_Herramienta_Trade_gastos".roles
FOR EACH ROW
EXECUTE FUNCTION "Schemas_Herramienta_Trade_gastos".set_updated_at();

DROP TRIGGER IF EXISTS trg_cavs_updated_at ON "Schemas_Herramienta_Trade_gastos".cavs;
CREATE TRIGGER trg_cavs_updated_at
BEFORE UPDATE ON "Schemas_Herramienta_Trade_gastos".cavs
FOR EACH ROW
EXECUTE FUNCTION "Schemas_Herramienta_Trade_gastos".set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON "Schemas_Herramienta_Trade_gastos".users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON "Schemas_Herramienta_Trade_gastos".users
FOR EACH ROW
EXECUTE FUNCTION "Schemas_Herramienta_Trade_gastos".set_updated_at();

DROP TRIGGER IF EXISTS trg_serials_updated_at ON "Schemas_Herramienta_Trade_gastos".serials;
CREATE TRIGGER trg_serials_updated_at
BEFORE UPDATE ON "Schemas_Herramienta_Trade_gastos".serials
FOR EACH ROW
EXECUTE FUNCTION "Schemas_Herramienta_Trade_gastos".set_updated_at();

DROP TRIGGER IF EXISTS trg_serial_movements_updated_at ON "Schemas_Herramienta_Trade_gastos".serial_movements;
CREATE TRIGGER trg_serial_movements_updated_at
BEFORE UPDATE ON "Schemas_Herramienta_Trade_gastos".serial_movements
FOR EACH ROW
EXECUTE FUNCTION "Schemas_Herramienta_Trade_gastos".set_updated_at();

DROP TRIGGER IF EXISTS trg_abastecimientos_updated_at ON "Schemas_Herramienta_Trade_gastos".abastecimientos;
CREATE TRIGGER trg_abastecimientos_updated_at
BEFORE UPDATE ON "Schemas_Herramienta_Trade_gastos".abastecimientos
FOR EACH ROW
EXECUTE FUNCTION "Schemas_Herramienta_Trade_gastos".set_updated_at();

DROP TRIGGER IF EXISTS trg_recepciones_updated_at ON "Schemas_Herramienta_Trade_gastos".recepciones;
CREATE TRIGGER trg_recepciones_updated_at
BEFORE UPDATE ON "Schemas_Herramienta_Trade_gastos".recepciones
FOR EACH ROW
EXECUTE FUNCTION "Schemas_Herramienta_Trade_gastos".set_updated_at();

DROP TRIGGER IF EXISTS trg_legalizaciones_updated_at ON "Schemas_Herramienta_Trade_gastos".legalizaciones;
CREATE TRIGGER trg_legalizaciones_updated_at
BEFORE UPDATE ON "Schemas_Herramienta_Trade_gastos".legalizaciones
FOR EACH ROW
EXECUTE FUNCTION "Schemas_Herramienta_Trade_gastos".set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_logs_updated_at ON "Schemas_Herramienta_Trade_gastos".audit_logs;
CREATE TRIGGER trg_audit_logs_updated_at
BEFORE UPDATE ON "Schemas_Herramienta_Trade_gastos".audit_logs
FOR EACH ROW
EXECUTE FUNCTION "Schemas_Herramienta_Trade_gastos".set_updated_at();
