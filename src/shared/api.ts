// URL del backend API.
// - Desarrollo: proxied via Vite a http://localhost:3001 → "/api"
// - Producción (VPS estático + Vercel backend): VITE_API_URL desde .env.production
//   Ejemplo: VITE_API_URL=https://ruleta-total.vercel.app/api
// - Fallback a "/api" (funciona con Vite proxy en dev y Vercel en producción antiguo)
export const API_URL = import.meta.env.VITE_API_URL || "/api";

/**
 * Petición al backend con JSON por defecto.
 * La ruleta pública no usa sesión; las acciones de administración añaden la
 * cabecera X-Operator-Password desde el panel.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}
