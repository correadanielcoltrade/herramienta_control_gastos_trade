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

   Agrega las siguientes variables en el dashboard de Render:

```
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   JWT_SECRET_KEY=tu-clave-super-secreta-aqui
   FRONTEND_URL=https://tu-frontend.onrender.com
   FLASK_DEBUG=False
```

   **Notas importantes:**

- `DATABASE_URL`: Reemplaza con la URL de tu base de datos PostgreSQL
- `JWT_SECRET_KEY`: Usa una clave segura y aleatoria (mínimo 32 caracteres)
- `FRONTEND_URL`: La URL completa de tu frontend en producción
- `FLASK_DEBUG`: Mantén en False en producción

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
- `.env.example`: Variables de entorno necesarias
- `requirements.txt`: Dependencias Python (incluye gunicorn)
- `run.py`: Script de inicio (compatible con Render)

¡Listo para desplegar! 🚀
