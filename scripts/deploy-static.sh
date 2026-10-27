#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# deploy-static.sh
# Compila el frontend y sube los archivos estáticos al VPS
# para servirlos con OpenLiteSpeed / ServerAvatar.
#
# Uso:
#   ./scripts/deploy-static.sh usuario@vps:/ruta/destino
#
# Ejemplo:
#   ./scripts/deploy-static.sh admin@192.168.1.100:/var/www/ruleta.tudominio.com/html
#
# Requisitos locales:
#   - npm instalado
#   - rsync disponible (o scp)
#   - acceso SSH al VPS
# ─────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Ruleta TOTAL - Deploy Frontend 🚀${NC}"
echo -e "${CYAN}========================================${NC}"

# ── 1. Validar argumentos ──
if [[ $# -lt 1 ]]; then
	echo -e "${RED}Error: falta el destino remoto.${NC}"
	echo "Uso: $0 usuario@host:/ruta/absoluta/destino"
	echo ""
	echo "Ejemplos:"
	echo "  $0 admin@vps:/var/www/ruleta.tudominio.com/html"
	echo "  $0 admin@vps:/home/serveravatar/dominios/ruleta.tudominio.com/public_html"
	exit 1
fi

REMOTE_TARGET="$1"
REMOTE_HOST="${REMOTE_TARGET%%:*}"
REMOTE_PATH="${REMOTE_TARGET#*:}"

# ── 2. Cargar variables de build ──
if [[ -f .env.production ]]; then
	echo -e "${YELLOW}📄 Cargando .env.production...${NC}"
	export $(grep -v '^\s*#' .env.production | grep -v '^\s*$' | xargs)
else
	echo -e "${YELLOW}⚠️  No se encontró .env.production. Usando defaults.${NC}"
	echo "   Crea .env.production con VITE_API_URL=https://tu-backend.vercel.app/api"
fi

# ── 3. Build ──
echo -e "${CYAN}🔨 Compilando frontend...${NC}"
npm run build
echo -e "${GREEN}✅ Build completado: dist/${NC}"

# ── 4. Verificar que existe dist/ ──
if [[ ! -d "dist" ]]; then
	echo -e "${RED}Error: No se generó la carpeta dist/.${NC}"
	exit 1
fi

# ── 5. Subida atómica ──
echo -e "${CYAN}📤 Subiendo a ${REMOTE_TARGET}...${NC}"

# Estrategia: subir a un directorio .new, luego renombrar a destino final.
# Esto evita servir archivos a medio copiar.
REMOTE_NEW="${REMOTE_PATH}.new"

# ssh para crear directorio .new si no existe
ssh "${REMOTE_HOST}" "mkdir -p '${REMOTE_NEW}'"

# rsync: copia archivos, borra lo que ya no existe en .new
rsync -avz --delete --no-owner --no-group \
	"./dist/" \
	"${REMOTE_HOST}:${REMOTE_NEW}/"

# Swap atómico: renombrar destino actual como .old, .new como destino, borrar .old
echo -e "${YELLOW}🔄 Intercambio atómico...${NC}"
ssh "${REMOTE_HOST}" "
  if [[ -d '${REMOTE_PATH}' ]]; then
    mv '${REMOTE_PATH}' '${REMOTE_PATH}.old'
  fi
  mv '${REMOTE_NEW}' '${REMOTE_PATH}'
  rm -rf '${REMOTE_PATH}.old'
"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ Deploy completado exitosamente${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Frontend: ${REMOTE_TARGET}"
echo -e "  Tamaño:   $(du -sh dist/ | cut -f1)"
echo ""
echo -e "${YELLOW}📌 No olvides:${NC}"
echo "  1. Verificar que el backend en Vercel tenga las env vars correctas"
echo "  2. Probar: curl -f https://tu-dominio.com"
echo "  3. Revisar CORS: FRONTEND_ORIGIN en Vercel"
echo ""