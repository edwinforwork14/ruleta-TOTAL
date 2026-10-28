import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	// Base path configurable via env (para subpath en VPS, ej. /ruleta/)
	// Por defecto "/" para dominio raíz
	base: process.env.VITE_BASE_PATH || "/",
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		port: 5177,
		proxy: {
			"/api": {
				target: "https://backend-ruleta-total.vercel.app",
				changeOrigin: true,
				secure: false,
			},
			"/api-ruleta": {
				target: "https://backend-ruleta-total.vercel.app",
				changeOrigin: true,
				secure: false,
			},
		},
	},
	build: {
		outDir: "dist",
		sourcemap: false,
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ["react", "react-dom"],
				},
			},
		},
	},
	define: {
		// Define global variables for the app
		__APP_VERSION__: JSON.stringify(process.env.npm_package_version),
		__BUILD_TIME__: JSON.stringify(new Date().toISOString()),
	},
});
