import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";

/**
 * Ajusta el título de la pestaña al tenant de la sesión.
 *
 * El manifiesto PWA ya NO se toca desde aquí: lo sirve el backend en
 * /api/v1/pwa/manifest resolviendo el tenant por subdominio, y el <link> es
 * estático en index.html. Reemplazarlo tras el login llegaba tarde — el
 * navegador lee el manifiesto al cargar la página, y el prompt de instalación
 * aparece típicamente antes de que exista sesión.
 *
 * La identidad se reparte así: la imagen del ícono identifica a la empresa y
 * el texto dice "EffiGuard". Por eso el label de iOS es fijo y concuerda con
 * el short_name del manifiesto.
 */
export function usePWAManifest() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const tenantName = user?.tenant_nombre ?? null;

    // El título de pestaña sí lleva la empresa: es contexto de escritorio,
    // no el label del ícono instalado.
    document.title = tenantName ? `EffiGuard · ${tenantName}` : "EffiGuard";

    let appleMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]'
    );
    if (!appleMeta) {
      appleMeta = document.createElement("meta");
      appleMeta.name = "apple-mobile-web-app-title";
      document.head.appendChild(appleMeta);
    }
    appleMeta.content = "EffiGuard";
  }, [user?.tenant_nombre]);
}
