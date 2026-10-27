# DEPLOYMENT.md — Ruleta TOTAL Frontend

## Arquitectura

```
┌─────────────────────────────────┐        ┌──────────────────────────────┐
│   VPS (OpenLiteSpeed)           │        │   Vercel (Serverless)        │
│                                 │        │   (repo: backend-ruleta-total)│
│   /var/www/ruleta.dominio.com/  │        │                              │
│   └── html/ (dist/)  ◄──── HTTP ──────►  │   https://backend.vercel.app  │
│       ├── index.html            │   CORS  │   └── /api/*                │
│       ├── assets/*.js           │        │       ├── /configuracion      │
│       ├── assets/*.css          │        │       ├── /spin               │
│       └── ... estáticos         │        │       ├── /auth/*             │
│                                 │        │       ├── /tickets/*          │
│   🟢 Frontend (React + Vite)    │        │       └── /roulettes/*        │
│   (solo archivos estáticos)     │        │   🟡 Backend (Express.js)     │
└─────────────────────────────────┘        │   🔵 Base de datos: Turso      │
                                           └──────────────────────────────┘
```

- **Frontend** (este repo): React 19 + Vite 7 → build estático → servido por OpenLiteSpeed
- **Backend** (repo separado): `github.com/edwinforwork14/backend-ruleta-total` → Vercel Functions
- **Base de datos**: Turso (libSQL serverless)

---

## 1. Configurar el Backend (repo separado)

El backend está en **`github.com/edwinforwork14/backend-ruleta-total`**.

### 1.1 Deploy en Vercel

1. Ir a [vercel.com](https://vercel.com) → **Add New → Project**
2. Importar repo: `edwinforwork14/backend-ruleta-total`
3. Configuración:
   - **Framework Preset**: Other
   - **Build Command**: `npm run build:backend`
   - **Output Directory**: `src/dist`
   - **Function Region**: `iad1` (US Este) o el más cercano a Turso

4. **Environment Variables** (Settings → Environment Variables):

| Variable | Valor | Nota |
|----------|-------|------|
| `DATABASE_URL` | `libsql://ruleta-total.aws-us-east-1.turso.io` | Ya configurada |
| `DATABASE_AUTH_TOKEN` | `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...` | Ya configurada |
| `OPERATOR_PASSWORD` | Tu contraseña admin | **Obligatorio** |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | |
| `TICKET_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | |
| `FRONTEND_ORIGIN` | `https://ruleta.tudominio.com` | Dominio exacto del frontend |
| `PUBLIC_APP_URL` | `https://ruleta.tudominio.com` | Para generar QR |
| `NODE_ENV` | `production` | |

5. **Deploy** → Vercel te da una URL como `https://backend-ruleta-total.vercel.app`

### 1.2 Verificar backend

```bash
curl https://backend-ruleta-total.vercel.app/api/health
# → {"status":"OK","timestamp":"..."}
```

---

## 2. Configurar el Frontend en el VPS (OpenLiteSpeed + ServerAvatar)

### 2.1 Build local

En tu máquina local (con Node.js):

```bash
# 1. Crear .env.production con la URL del backend en Vercel
cat > .env.production << EOF
VITE_API_URL=https://backend-ruleta-total.vercel.app/api
VITE_BASE_PATH=/
EOF

# 2. Compilar
npm run build

# 3. La carpeta dist/ se genera con los archivos estáticos
```

### 2.2 Subir a ServerAvatar

**Opción A: Panel de archivos de ServerAvatar**
1. Ir a **Sitios web** → tu dominio → **File Manager**
2. Subir todo el contenido de `dist/` al directorio raíz del sitio (ej. `/home/serveravatar/dominios/ruleta.tudominio.com/public_html`)

**Opción B: Script automatizado**
```bash
./scripts/deploy-static.sh admin@vps:/home/serveravatar/dominios/ruleta.tudominio.com/public_html
```

### 2.3 Configurar sitio en ServerAvatar

1. **Crear sitio web**:
   - Dominio: `ruleta.tudominio.com`
   - Tipo: **PHP/Static** (NO Node.js)
   - Raíz: `/home/serveravatar/dominios/ruleta.tudominio.com/public_html`

2. **SSL**: Solicitar certificado Let's Encrypt desde ServerAvatar

3. **Rewrite rules** (si ServerAvatar lo permite via .htaccess o panel):

```
RewriteEngine On
# Archivos existentes se sirven directo
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
# Cualquier otra ruta → index.html (SPA fallback)
RewriteRule ^(.*)$ /index.html [L]
```

> La app usa query params (`?view=play|admin|menu`), así que el catch-all es simple.

---

## 3. Variables de entorno: ¿dónde va cada una?

| Variable | Dónde se define | Visible en navegador |
|----------|----------------|---------------------|
| `VITE_API_URL` | `.env.production` local (build) | **SÍ** (en bundle JS) |
| `VITE_BASE_PATH` | `.env.production` local (build) | **SÍ** |
| **Backend secrets** | Repo `backend-ruleta-total` → Vercel Dashboard | **NO** 🔒 |

> **El VPS no tiene ningún secret**. Solo archivos estáticos (`dist/`).  
> **`.env.production` local** solo contiene `VITE_API_URL` (público, necesario para el build).

---

## 4. Actualización (deploy nuevo)

### Frontend (este repo)

```bash
# Local
git pull origin produccion
npm ci
npm run build

# Subir a VPS
./scripts/deploy-static.sh admin@vps:/home/serveravatar/dominios/ruleta.tudominio.com/public_html
```

### Backend (repo separado)

```bash
cd ../backend-ruleta-total
# hacer cambios...
git push origin master
# Vercel detecta el push y redeploy automáticamente
```

---

## 5. Rollback

### Frontend
```bash
# El script deploy-static.sh deja el directorio .old
ssh admin@vps "mv /ruta/public_html /ruta/public_html.broken && mv /ruta/public_html.old /ruta/public_html"
```

### Backend
En Vercel Dashboard → Deployments → último deploy funcional → "Promote to Production"

### Base de datos
Backups automáticos de Turso

---

## 6. Health check

```bash
# Backend en Vercel
curl -f https://backend-ruleta-total.vercel.app/api/health

# Frontend en VPS
curl -f -o /dev/null https://ruleta.tudominio.com
```

---

## 7. Funcionalidades que requieren backend

| Funcionalidad | Endpoint | ¿Funciona sin backend? |
|--------------|----------|----------------------|
| Mostrar ruleta con premios | `GET /api/configuracion` | ❌ |
| Girar la ruleta (con ticket) | `POST /api/spin` | ❌ |
| Login de operador | `GET/POST /api/auth/*` | ❌ |
| CRUD plantillas ruleta | `GET/POST/PUT/DELETE /api/roulettes/*` | ❌ |
| Generar/validar tickets QR | `GET/POST /api/tickets/*` | ❌ |
| Imágenes de premios | `GET /api/prizes/:id/image` | ❌ |
| Calibración de ruleta | `GET/PUT /api/wheel/calibration` | ❌ |
| **Servir HTML/CSS/JS/IMG** | Archivos estáticos | **✅ SÍ** |

> Sin el backend en Vercel, la app **no funciona**. El frontend es la interfaz, pero toda la lógica y datos están en la API.

---

## 8. Lista de verificación

| Tarea | Estado |
|-------|--------|
| Backend deployado en Vercel (`backend-ruleta-total`) | |
| Variables de entorno configuradas en Vercel (backend repo) | |
| Turso BD accesible desde Vercel | |
| Build local genera `dist/` correctamente | |
| `dist/` subido al VPS via ServerAvatar o script | |
| SSL activo (Let's Encrypt) | |
| Sitio carga https://ruleta.tudominio.com | |
| Giro de ruleta funciona (llama a Vercel API) | |
| Login de operador funciona (cookie cross-domain) | |
| CORS configurado (`FRONTEND_ORIGIN` en Vercel backend) | |
| Script `deploy-static.sh` funcional | |

---

## 9. Comandos rápidos

```bash
# Generar secrets para backend
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('TICKET_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"

# Build frontend
npm run build

# Deploy frontend a VPS
./scripts/deploy-static.sh usuario@vps:/ruta/public_html

# Deploy backend a Vercel (desde repo backend-ruleta-total)
git push origin master
```

---

## 10. Referencias

- **Frontend repo**: `github.com/edwinforwork14/ruleta-TOTAL` (rama `produccion`)
- **Backend repo**: `github.com/edwinforwork14/backend-ruleta-total` (rama `master`)
- **Base de datos**: Turso `libsql://ruleta-total.aws-us-east-1.turso.io`
- **Vercel Backend URL**: `https://backend-ruleta-total.vercel.app`