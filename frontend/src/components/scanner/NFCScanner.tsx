import { useEffect, useState } from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

// Declaraciones de tipos para Web NFC API (no incluidas en TypeScript lib estándar)
interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: DataView;
  encoding?: string;
  lang?: string;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: NDEFMessage;
}

interface NDEFReaderInstance extends EventTarget {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
}

declare global {
  interface Window {
    NDEFReader?: new () => NDEFReaderInstance;
  }
}

interface NFCScannerProps {
  onScan: (uid: string) => void;
  active: boolean;
}

export function NFCScanner({ onScan, active }: NFCScannerProps) {
  const [status, setStatus] = useState<"checking" | "scanning" | "unsupported" | "error">("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!active) return;

    if (!("NDEFReader" in window)) {
      setStatus("unsupported");
      return;
    }

    const controller = new AbortController();
    let mounted = true;

    async function startNFC() {
      try {
        const reader = new window.NDEFReader!();

        reader.onreading = (event: NDEFReadingEvent) => {
          if (!mounted) return;
          // Normalizar el serial number a mayúsculas (ej: "8c:f0:4d:b1" → "8C:F0:4D:B1")
          const uid = event.serialNumber.toUpperCase();
          onScan(uid);
        };

        reader.onreadingerror = () => {
          if (!mounted) return;
          setStatus("error");
          setErrorMsg("Error al leer el tag NFC. Intenta de nuevo.");
        };

        await reader.scan({ signal: controller.signal });
        if (mounted) setStatus("scanning");
      } catch (err) {
        if (!mounted) return;
        if ((err as Error).name === "AbortError") return;
        const msg = (err as Error).message ?? String(err);
        if (/permission/i.test(msg)) {
          setStatus("error");
          setErrorMsg("Permiso NFC denegado. Habilítalo en la configuración del navegador.");
        } else {
          setStatus("error");
          setErrorMsg("No se pudo iniciar NFC: " + msg);
        }
      }
    }

    setStatus("checking");
    setErrorMsg(null);
    startNFC();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [active, onScan, retryCount]);

  if (!active) return null;

  if (status === "unsupported") {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-yellow-400 text-sm text-center px-4">
        <WifiOff size={28} />
        <p className="font-semibold">NFC no disponible</p>
        <p className="text-xs text-gray-400">
          Requiere Chrome en Android con NFC activado.
        </p>
      </div>
    );
  }

  if (status === "error") {
    const isPermission = errorMsg?.toLowerCase().includes("permiso");
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-red-400 text-sm text-center px-4">
        <WifiOff size={28} />
        <p className="font-semibold">{errorMsg}</p>
        {isPermission && (
          <ol className="text-xs text-gray-400 max-w-xs text-left space-y-1 list-decimal list-inside">
            <li>Toca el menú <span className="text-white font-medium">⋮</span> (tres puntos) de la app</li>
            <li>Selecciona <span className="text-white font-medium">Configuración del sitio</span></li>
            <li>Busca <span className="text-white font-medium">NFC</span> y cámbialo a <span className="text-white font-medium">Permitir</span></li>
            <li>Vuelve y toca <span className="text-white font-medium">Reintentar</span></li>
          </ol>
        )}
        <button
          onClick={() => { setErrorMsg(null); setRetryCount((c) => c + 1); }}
          className="mt-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // checking | scanning
  return (
    <div className="flex flex-col items-center gap-3 py-5 text-blue-400 text-sm">
      <div className="relative">
        <Wifi size={40} className="text-blue-400" />
        <Loader2 size={16} className="absolute -top-1 -right-1 animate-spin text-blue-300" />
      </div>
      <p className="font-semibold">
        {status === "checking" ? "Iniciando NFC..." : "Acerca el tag NFC"}
      </p>
      <p className="text-xs text-gray-400">Mantén la tarjeta cerca del lector NFC del celular</p>
    </div>
  );
}
