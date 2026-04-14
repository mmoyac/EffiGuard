import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Camera, CameraOff, FlipHorizontal } from "lucide-react";

interface CameraScannerProps {
  onScan: (uid: string) => void;
  active: boolean;
  id?: string;
}

export function CameraScanner({ onScan, active, id = "camera-qr-region" }: CameraScannerProps) {
  const SCANNER_ID = id;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [useBack, setUseBack] = useState(true);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    async function startScanner() {
      setError(null);
      setStarting(true);

      const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });
      scannerRef.current = scanner;

      const config = { fps: 10, qrbox: { width: 200, height: 200 } };

      // Intentar primero con la cámara preferida, luego con la otra
      const facingModes = useBack
        ? ["environment", "user"]
        : ["user", "environment"];

      let started = false;
      let lastErr: unknown = null;

      for (const facingMode of facingModes) {
        if (cancelled) return;
        try {
          await scanner.start(
            { facingMode },
            config,
            (decodedText) => onScanRef.current(decodedText.trim()),
            undefined
          );
          started = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (cancelled) return;

      if (!started) {
        const msg: string = (lastErr as { message?: string })?.message ?? String(lastErr);
        if (/permission|denied|not allowed/i.test(msg)) {
          setError("Permiso de cámara denegado. Habilítalo en la configuración del navegador.");
        } else {
          setError("No se pudo iniciar la cámara: " + msg);
        }
        setStarting(false);
        return;
      }

      setStarting(false);

      // Detectar si hay más de una cámara para el botón flip
      Html5Qrcode.getCameras()
        .then((devices) => { if (!cancelled) setHasMultipleCameras(devices.length > 1); })
        .catch(() => {});
    }

    startScanner();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        const state = s.getState();
        if (
          state === Html5QrcodeScannerState.SCANNING ||
          state === Html5QrcodeScannerState.PAUSED
        ) {
          s.stop().catch(() => {});
        }
      }
      scannerRef.current = null;
    };
  }, [active, useBack, SCANNER_ID]);

  function switchCamera() {
    setUseBack((v) => !v);
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-red-400 text-sm text-center px-4">
        <CameraOff size={32} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black min-h-[240px]">
      {/* html5-qrcode inyecta el video aquí — necesita tener ancho definido */}
      <div id={SCANNER_ID} className="w-full" style={{ minHeight: 240 }} />

      {/* Overlay: esquinas decorativas */}
      {!starting && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-48 h-48 relative">
            {[
              "top-0 left-0 border-t-2 border-l-2",
              "top-0 right-0 border-t-2 border-r-2",
              "bottom-0 left-0 border-b-2 border-l-2",
              "bottom-0 right-0 border-b-2 border-r-2",
            ].map((cls, i) => (
              <div key={i} className={`absolute w-6 h-6 border-blue-400 ${cls}`} />
            ))}
          </div>
        </div>
      )}

      {starting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-2 text-gray-400 text-sm">
            <Camera size={28} className="animate-pulse text-blue-400" />
            <span>Iniciando cámara...</span>
          </div>
        </div>
      )}

      {hasMultipleCameras && !starting && (
        <button
          onClick={switchCamera}
          className="absolute top-3 right-3 p-2 rounded-xl bg-black/50 text-white hover:bg-black/70 transition-colors"
          title="Cambiar cámara"
        >
          <FlipHorizontal size={20} />
        </button>
      )}
    </div>
  );
}
