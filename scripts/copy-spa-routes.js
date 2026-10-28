import { existsSync, mkdirSync, copyFileSync, readdirSync } from "fs";
import { resolve } from "path";

/**
 * Copia index.html a directorios para cada ruta SPA path-based.
 * Esto permite que servidores estáticos (serve, nginx, OpenLiteSpeed, etc.)
 * sirvan las rutas sin necesidad de rewrite rules.
 */

const DIST_DIR = resolve("dist");
const INDEX_FILE = resolve(DIST_DIR, "index.html");

// Rutas path-based que la app usa (agrega aquí cualquier nueva ruta path-based)
const SPA_ROUTES = [
  "login-admin",
  // Agrega aquí futuras rutas path-based, ej: "admin", "panel", "perfil", etc.
];

if (!existsSync(INDEX_FILE)) {
  console.error("❌ No se encontró dist/index.html. Ejecuta 'npm run build' primero.");
  process.exit(1);
}

console.log("📦 Copiando index.html a rutas SPA path-based...\n");

let copied = 0;
for (const route of SPA_ROUTES) {
  const routeDir = resolve(DIST_DIR, route);
  const targetFile = resolve(routeDir, "index.html");

  if (!existsSync(routeDir)) {
    mkdirSync(routeDir, { recursive: true });
  }

  copyFileSync(INDEX_FILE, targetFile);
  console.log(`  ✅ ${route}/index.html`);
  copied++;
}

console.log(`\n✅ ${copied} ruta(s) SPA preparadas para servidor estático.`);
console.log("   Ahora 'dist/' se puede servir con cualquier servidor estático (serve, nginx, OpenLiteSpeed, etc.) sin rewrite rules.\n");