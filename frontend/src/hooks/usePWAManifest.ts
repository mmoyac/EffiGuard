import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Actualiza dinámicamente el Web App Manifest y los meta tags de iOS
 * cada vez que cambia el tenant del usuario autenticado.
 *
 * - Android (Chrome): el browser re-fetch del manifest nuevo y muestra
 *   el nombre del tenant en la pantalla de instalación y en el home screen.
 * - iOS (Safari): lee apple-mobile-web-app-title para el label del ícono.
 */
export function usePWAManifest() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const tenantName = user?.tenant_nombre ?? null;
    const tenantId = user?.tenant_id ?? null;

    // ── Manifest link ──────────────────────────────────────────────────────
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link) {
      link.href = tenantId
        ? `${API_BASE}/pwa/manifest/${tenantId}`
        : "/manifest.webmanifest";
    }

    // ── <title> ────────────────────────────────────────────────────────────
    document.title = tenantName ? `EffiGuard · ${tenantName}` : "EffiGuard";

    // ── iOS: apple-mobile-web-app-title ───────────────────────────────────
    let appleMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]'
    );
    if (!appleMeta) {
      appleMeta = document.createElement("meta");
      appleMeta.name = "apple-mobile-web-app-title";
      document.head.appendChild(appleMeta);
    }
    // iOS trunca a ~14 chars en el home screen
    appleMeta.content = tenantName ? tenantName.slice(0, 14) : "EffiGuard";
  }, [user?.tenant_id, user?.tenant_nombre]);
}
