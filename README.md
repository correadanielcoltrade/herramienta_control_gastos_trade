# MKP Serial Control

Aplicacion web para control de seriales, inventario y trazabilidad completa por CAV.

## Stack

- Backend: Flask + SQLAlchemy + JWT
- Frontend: React + TypeScript + TailwindCSS + React Query
- DB: PostgreSQL en `mkpsupli`, esquema `Schemas_Herramienta_Trade_gastos`

## Estructura

- `backend/`: API REST y reglas de negocio
- `backend/migrations/`: migraciones Alembic
- `frontend/`: interfaz responsive y escaneo con camara
- `sql/`: esquema y semillas PostgreSQL
- `docs/`: arquitectura y despliegue

## Documentos clave

- [Arquitectura](docs/ARCHITECTURE.md)
- [Despliegue](docs/DEPLOYMENT.md)
- [Implementacion CAVs](docs/IMPLEMENTACION_CAVS.md)
- [SQL de esquema](sql/schema.sql)
- [SQL de semillas](sql/seed.sql)
