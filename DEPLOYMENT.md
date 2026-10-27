# DEPLOYMENT.md — Ruleta TOTAL

## Arquitectura

```
┌─────────────────────────────────┐        ┌──────────────────────────────┐
│   VPS (OpenLiteSpeed)           │        │   Vercel (Serverless)        │
│                                 │        │                              │
│   /var/www/ruleta.dominio.com/  │        │   https://ruleta-total.vercel.app
│   └── html/ (dist/)  ◄──── HTTP ──────►  │   └── /api/*                 │
│       ├── index.html            │   CORS  │       ├── /configuracion     │
│       ├── assets/*.js           │        │       ├── /spin              │
│       ├── assets/*.css          │        │       ├── /auth/*            │
│       └── ... estáticos         │        │       ├── /tickets/*         │
│                                 │        │       └── /roulettes/*       │
│   🟢 Frontend (React + Vite)    │        │   🟡 Backend (Express.js)    │
│   (solo archivos estáticos)     │        │   🔵 Base de datos externa   │
└─────────────────────────────────┘        └──────────────────────────────┘
```

- **Frontend**: React 19 + Vite 7 → build estático → servido por OpenLiteSpeed
- **Backend**: Express.js en Vercel Functions (serverless)
- **Base de datos**: Turso / PlanetScale / Neon / MariaDB expuesta (debe ser accesible desde Vercel)

---

## 1. Configurar el backend en Vercel

### 1.1 Preparar el repositorio

```bash
git checkout produccion
git push origin produccion
```

### 1.2 Conectar en Vercel

1. Ir a [vercel.com](https://vercel.com) → **Add New → Project**
2. Importar el repositorio (GitHub/GitLab)
3. Configuración:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (raíz)
   - **Build Command**: `npm run build:backend && npm run build:frontend`
   - **Output Directory**: `dist`
   - **Function Region**: El más cercano a tu BD (ej. `iad1` para US Este)

4. **Environment Variables** (Settings → Environment Variables):

| Variable | Valor | Nota |
|----------|-------|------|
| `MARIADB_HOST` | `IP_PUBLICA_DEL_VPS` | IP donde corre MariaDB |
| `MARIADB_PORT` | `3306` | |
| `MARIADB_DATABASE` | `ruleta` | Nombre BD |
| `MARIADB_USER` | `ruleta_app` | Usuario con permisos remotos |
| `MARIADB_PASSWORD` | (contraseña real) | |
| `OPERATOR_PASSWORD` | Contraseña del panel admin | **Obligatorio** |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | |
| `TICKET_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | |
| `FRONTEND_ORIGIN` | `https://ruleta.tudominio.com` | Dominio exacto del frontend |
| `PUBLIC_APP_URL` | `https://ruleta.tudominio.com` | Para generar QR |
| `NODE_ENV` | `production` | |

5. **Deploy** → Vercel te da una URL como `https://ruleta-total.vercel.app`

### 1.3 Verificar backend

```bash
curl https://ruleta-total.vercel.app/api/health
# → {"status":"OK","timestamp":"..."}
```

---

## 2. Configurar la base de datos (MariaDB en el VPS)

La base de datos MariaDB está en el VPS. Para que Vercel pueda conectarse, hay que:

### 2.1 Permitir conexiones remotas en MariaDB

1. Editar la configuración de MariaDB (normalmente `/etc/mysql/mariadb.conf.d/50-server.cnf`):
   ```ini
   # Cambiar bind-address de 127.0.0.1 a 0.0.0.0
   bind-address = 0.0.0.0
   ```

2. Reiniciar MariaDB:
   ```bash
   sudo systemctl restart mariadb
   ```

### 2.2 Crear usuario con acceso remoto

```sql
CREATE USER 'ruleta_app'@'%' IDENTIFIED BY 'tu_password_seguro';
GRANT SELECT, INSERT, UPDATE, DELETE ON ruleta.* TO 'ruleta_app'@'%';
FLUSH PRIVILEGES;
```

> ⚠️ **Seguridad**: `'%'` permite desde cualquier IP. Para más seguridad, limítalo a IPs de Vercel:
> ```sql
> -- IPs de Vercel (pueden cambiar, consultar documentación actualizada)
> CREATE USER 'ruleta_app'@'3.22.29.227' IDENTIFIED BY '...';
> CREATE USER 'ruleta_app'@'18.220.181.38' IDENTIFIED BY '...';
> ```
> O mejor: usar un **túnel SSH** o **Cloudflare Tunnel** para no exponer MariaDB directamente.

### 2.3 Abrir puerto 3306 en el firewall

Desde ServerAvatar o por SSH:
```bash
sudo ufw allow from any to any port 3306 proto tcp
# O más restrictivo:
sudo ufw allow from 3.22.29.227 to any port 3306 proto tcp
sudo ufw allow from 18.220.181.38 to any port 3306 proto tcp
```

### 2.4 Configurar variables en Vercel

| Variable | Valor |
|----------|-------|
| `MARIADB_HOST` | IP pública del VPS |
| `MARIADB_PORT` | `3306` |
| `MARIADB_DATABASE` | `ruleta` |
| `MARIADB_USER` | `ruleta_app` |
| `MARIADB_PASSWORD` | (la que definiste) |

---

## 3. Configurar el frontend en el VPS (OpenLiteSpeed + ServerAvatar)

### 3.1 Build local

En tu máquina local (con Node.js):

```bash
# 1. Crear .env.production con la URL del backend en Vercel
cat > .env.production << EOF
VITE_API_URL=https://ruleta-total.vercel.app/api
VITE_BASE_PATH=/
EOF

# 2. Compilar
npm run build

# 3. La carpeta dist/ se genera con los archivos estáticos
```

### 3.2 Subir a ServerAvatar

**Opción A: Panel de archivos de ServerAvatar**
1. Ir a **Sitios web** → tu dominio → **File Manager**
2. Subir todo el contenido de `dist/` al directorio raíz del sitio (ej. `/home/serveravatar/dominios/ruleta.tudominio.com/public_html`)

**Opción B: Script automatizado**
```bash
./scripts/deploy-static.sh admin@vps:/home/serveravatar/dominios/ruleta.tudominio.com/public_html
```

### 3.3 Configurar sitio en ServerAvatar

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

## 4. Variables de entorno: ¿dónde va cada una?

| Variable | Dónde se define | Visible en navegador |
|----------|----------------|---------------------|
| `VITE_API_URL` | `.env.production` local (build) | **SÍ** (en bundle JS) |
| `VITE_BASE_PATH` | `.env.production` local (build) | **SÍ** |
| `MARIADB_*` | Vercel Dashboard (env vars) | **NO** 🔒 |
| `OPERATOR_PASSWORD` | Vercel Dashboard | **NO** 🔒 |
| `SESSION_SECRET` | Vercel Dashboard | **NO** 🔒 |
| `TICKET_ENCRYPTION_KEY` | Vercel Dashboard | **NO** 🔒 |
| `FRONTEND_ORIGIN` | Vercel Dashboard | **NO** 🔒 |
| `PUBLIC_APP_URL` | Vercel Dashboard | **NO** 🔒 |

> **El VPS no tiene ningún secret**. Solo archivos estáticos (`dist/`).  
> **`.env.production` local** solo contiene `VITE_API_URL` (público, necesario para el build).

---

## 5. Actualización (deploy nuevo)

### Frontend (cada vez que cambies el frontend)

```bash
# Local
git pull origin produccion
npm ci
cp .env.production .env.production  # o asegurarte que existe
npm run build

# Subir a VPS
./scripts/deploy-static.sh admin@vps:/home/serveravatar/dominios/ruleta.tudominio.com/public_html
```

### Backend (cada vez que cambies el backend)

```bash
git push origin produccion
# Vercel detecta el push y redeploy automáticamente
# O ir a Vercel Dashboard → Deployments → Trigger Deploy
```

---

## 6. Rollback

### Frontend
```bash
# El script deploy-static.sh deja el directorio .old por 1 minuto
# Para restaurar manualmente:
ssh admin@vps "mv /ruta/public_html /ruta/public_html.broken && mv /ruta/public_html.old /ruta/public_html"
```

### Backend
En Vercel Dashboard → Deployments → último deploy funcional → "Promote to Production"

### Base de datos
Usar backups automáticos de Turso/PlanetScale o MariaDB

---

## 7. Health check

```bash
# Backend en Vercel
curl -f https://ruleta-total.vercel.app/api/health

# Frontend en VPS
curl -f -o /dev/null https://ruleta.tudominio.com
```

---

## 8. Funcionalidades que requieren backend

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

## 9. Lista de verificación

| Tarea | Estado |
|-------|--------|
| Repositorio en GitHub (`ramaproduccion`) | |
| Proyecto creado en Vercel conectado al repo | |
| Variables de entorno configuradas en Vercel | |
| Base de datos accesible desde Vercel (Turso/PlanetScale/MariaDB remoto) | |
| Build local genera `dist/` correctamente | |
| Build en Vercel exitoso | |
| `curl /api/health` desde Vercel responde OK | |
| `dist/` subido al VPS via ServerAvatar o script | |
| SSL activo (Let's Encrypt) | |
| Sitio carga https://ruleta.tudominio.com | |
| Giro de ruleta funciona (llama a Vercel API) | |
| Login de operador funciona (cookie cross-domain) | |
| CORS configurado (`FRONTEND_ORIGIN` en Vercel) | |
| Script `deploy-static.sh` funcional | |

---

## 10. Comandos rápidos

```bash
# Generar secrets
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('TICKET_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"

# Build frontend
npm run build

# Deploy frontend a VPS
./scripts/deploy-static.sh usuario@vps:/ruta/public_html

# Deploy backend a Vercel
git push origin produccion
```