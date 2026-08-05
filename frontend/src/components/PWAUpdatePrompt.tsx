import { useEffect, useRef } from "react";
import { RefreshCw, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

/** Cada cuánto le preguntamos al servidor si hay un sw.js nuevo. */
const INTERVALO_CHEQUEO = 60 * 60 * 1000;

/**
 * Aviso de "hay una versión nueva".
 *
 * El navegador sólo busca un service worker nuevo al registrar (es decir, al
 * cargar la página). Una PWA instalada puede quedar días abierta sin recargar,
 * así que además chequeamos por intervalo, al volver a primer plano y al
 * recuperar conexión.
 */
export function PWAUpdatePrompt() {
  const registroRef = useRef<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registro) {
      registroRef.current = registro ?? null;
    },
  });

  useEffect(() => {
    const chequear = () => {
      // Sin red, update() falla y deja el registro en un estado inconsistente.
      if (registroRef.current && navigator.onLine) {
        void registroRef.current.update();
      }
    };
    const alVolverAlFrente = () => {
      if (document.visibilityState === "visible") chequear();
    };

    const timer = window.setInterval(chequear, INTERVALO_CHEQUEO);
    document.addEventListener("visibilitychange", alVolverAlFrente);
    window.addEventListener("online", chequear);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", alVolverAlFrente);
      window.removeEventListener("online", chequear);
    };
  }, []);

  if (!hayVersionNueva) return null;

  return (
    <div
      role="status"
      // bottom-20 lo deja por encima del botón flotante del ChatWidget
      // (bottom-4 right-4) sin robarle ancho: a 320px el título no cabía.
      className="fixed bottom-20 left-4 right-4 z-[60] sm:left-auto sm:w-96 rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-100">
            Nueva versión disponible
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            Recarga para aplicar los cambios.
          </p>
        </div>
        <button
          onClick={() => setHayVersionNueva(false)}
          aria-label="Descartar aviso"
          className="flex-shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        onClick={() => void updateServiceWorker(true)}
        className="mt-3 min-h-[44px] w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
      >
        Actualizar
      </button>
    </div>
  );
}
