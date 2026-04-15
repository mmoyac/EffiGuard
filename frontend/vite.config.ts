import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Manifest base (fallback para usuarios no autenticados).
      // usePWAManifest() lo reemplaza dinámicamente tras el login.
      manifest: {
        name: "EffiGuard",
        short_name: "EffiGuard",
        description: "Gestión de activos y control de bodega",
        theme_color: "#111827",
        background_color: "#111827",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        skipWaiting: true,
        clientsClaim: true,
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
  },
});
