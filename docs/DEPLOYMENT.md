# Despliegue

## 1. Base de datos PostgreSQL

La base de datos objetivo es `mkpsupli`. Este proyecto crea y usa el esquema `Schemas_Herramienta_Trade_gastos`.

Tienes dos opciones:

- Opcion recomendada: ejecutar migraciones Alembic.
- Opcion manual: cargar directamente `sql/schema.sql` y `sql/seed.sql`.

### Opcion manual

```sql
\c mkpsupli
\i sql/schema.sql
\i sql/seed.sql
```

## 2. Variables de entorno backend

Copia `backend/.env.example` como `backend/.env` y ajusta:

- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_SSLMODE`
- `DB_SCHEMA`
- `JWT_SECRET_KEY`
- `FRONTEND_URL`

## 3. Migraciones

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
```

## 4. Backend Flask

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Tambien puedes usar:

```bash
cd backend
flask --app app.main run --host 0.0.0.0 --port 8001
```

## 5. Frontend React

```bash
cd frontend
npm install
npm run dev
```

Configura `VITE_API_URL=http://localhost:8001/api/v1`.

## 6. Produccion recomendada

- Ejecutar Flask detras de Gunicorn o Waitress.
- Servir el frontend generado por `npm run build` desde Nginx.
- Mantener PostgreSQL con backups y rotacion de logs.
- Configurar HTTPS, encabezados de seguridad y rotacion de `JWT_SECRET_KEY`.
- Agregar monitoreo de errores y salud (`/health`).

## 7. Orden sugerido de liberacion

1. Ejecutar `alembic upgrade head`.
2. Sembrar roles y usuario administrador.
3. Desplegar backend.
4. Desplegar frontend.
5. Probar login, abastecimiento, recibo y legalizacion.
