# Guía de Despliegue en Render

Este backend está configurado para desplegarse en **Render** sin cambios adicionales.

## Pasos para desplegar:

### 1. **Conecta tu repositorio a Render:**
   - Ve a [render.com](https://render.com)
   - Crea un nuevo **Web Service**
   - Conecta tu repositorio de GitHub
   - Selecciona la rama `main` (o la que desees desplegar)

### 2. **Configuración en Render:**

   **Build Command:**
   ```
   pip install -r requirements.txt && alembic upgrade head
   ```

   **Start Command:**
   ```
   gunicorn -w 4 -b 0.0.0.0:$PORT "app.main:app"
   ```

   **Root Directory:** `backend`

### 3. **Variables de Entorno (Environment Variables):**

   Copia todas las variables del archivo `.env` al dashboard de Render. Son:

   ```
   APP_NAME=MKP Serial Control
   API_V1_PREFIX=/api/v1
   FRONTEND_URL=https://tu-frontend.onrender.com
   DB_USER=root
   DB_PASSWORD=tu-contraseña
   DB_HOST=dpg-d7btvvpr0fns73bnrrt0-a.oregon-postgres.render.com
   DB_PORT=5432
   DB_NAME=mkpsupli
   DB_SSLMODE=require
   DB_SCHEMA=Schemas_Herramienta_Trade_gastos
   JWT_SECRET_KEY=change-me-in-production
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=480
   FLASK_DEBUG=false
   ```

   **O simplemente usa `DATABASE_URL` como variable única:**
   ```
   DATABASE_URL=postgresql://root:PASSWORD@HOST:5432/mkpsupli
   ```

### 4. **Base de Datos:**

   Si usas Render también para la base de datos PostgreSQL:
   - Crea un PostgreSQL Database en Render
   - Copia la `DATABASE_URL` y pégala en el Web Service
   - Las migraciones se ejecutarán automáticamente en el `release` command

### 5. **Desplegar:**

   Una vez configurado, simplemente haz `git push` a la rama configurada y Render desplegará automáticamente.

## Verificación:

   Después de desplegar, prueba el endpoint de salud:
   ```
   GET https://tu-app.onrender.com/health
   ```

   Deberías recibir:
   ```json
   {"status": "ok"}
   ```

## Archivos incluidos:

- `Procfile`: Configuración de despliegue para Render
- `.env`: Variables de entorno (copiar a Render)
- `requirements.txt`: Dependencias Python (incluye gunicorn)
- `run.py`: Script de inicio (compatible con Render)

¡Listo para desplegar! 🚀
