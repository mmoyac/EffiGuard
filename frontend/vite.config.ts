import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt": el SW nuevo se queda en waiting hasta que el usuario acepta
      // desde <PWAUpdatePrompt>. Con "autoUpdate" + skipWaiting el SW nuevo
      // tomaba control de una pestaña que seguía ejecutando el bundle viejo.
      registerType: "prompt",
      // Registramos desde React para poder mostrar el aviso de actualización.
      injectRegister: null,
      // El manifiesto lo sirve el backend en /api/v1/pwa/manifest, resuelto por
      // subdominio. Si el plugin generase el suyo, inyectaría un segundo
      // <link rel="manifest"> en index.html y el navegador honra el primero que
      // encuentra: una carrera silenciosa por cuál identidad gana.
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        cleanupOutdatedCaches: true,
        // El SW responde las navegaciones con index.html; sin esta lista
        // también se tragaba /docs y /static, que los sirve el backend.
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/static\//,
          /^\/(docs|redoc|openapi\.json)/,
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    watch: {
      // Polling necesario en Docker sobre Windows (los watchers de inotify no funcionan con volúmenes)
      usePolling: true,
      interval: 1000,
    },
    proxy: {
      "/n8n-webhook": {
        target: "https://n8n.effi4tech.cl",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/n8n-webhook/, ""),
      },
    },
  },
});
