# Guía de Despliegue Frontend en Render

Este frontend está configurado para desplegarse en **Render** de forma automática.

## Pasos para desplegar:

### 1. **Conecta tu repositorio a Render:**
   - Ve a [render.com](https://render.com)
   - Crea un nuevo **Static Site** (no Web Service)
   - Conecta tu repositorio de GitHub
   - Selecciona la rama `main`

### 2. **Configuración en Render:**

   **Build Command:**
   ```
   npm install && npm run build
   ```

   **Publish Directory:** `dist`
   
   **Root Directory:** `frontend`

### 3. **Variables de Entorno:**

   Agrega esta variable en el dashboard de Render:

   ```
   VITE_API_BASE_URL=https://tu-backend.onrender.com/api/v1
   ```

   **Reemplaza `tu-backend` con la URL real de tu backend en Render.**

### 4. **Configuración de Rutas (Para SPA):**

   Si tu frontend no carga las rutas correctamente después de desplegar:
   
   - En Render, ve a **Settings**
   - Busca **Redirects/Rewrites**
   - Agrega esta rewrite:
     - Source: `/*`
     - Destination: `/index.html`
     - Status: `200`

   Esto es necesario para que React Router funcione correctamente.

## Estructura de Ambientes:

### Desarrollo (`.env`):
```
VITE_API_BASE_URL=http://localhost:8001/api/v1
```

### Producción (`.env.production`):
```
VITE_API_BASE_URL=https://tu-backend.onrender.com/api/v1
```

## Cómo funciona:

- El archivo `src/config/environment.ts` gestiona la configuración según el ambiente
- En desarrollo: `npm run dev` usa `.env`
- En producción: `npm run build` usa `.env.production`
- El cliente HTTP (`src/api/client.ts`) usa automáticamente la URL correcta

## Verificación:

Después de desplegar:
1. Abre la consola del navegador (F12)
2. Ve a Network y haz login
3. Verifica que las llamadas vayan a `https://tu-backend.onrender.com/api/v1`

¡Listo para desplegar! 🚀
