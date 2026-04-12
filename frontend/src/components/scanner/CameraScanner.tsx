import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Camera, CameraOff, FlipHorizontal } from "lucide-react";

interface CameraScannerProps {
  onScan: (uid: string) => void;
  active: boolean;
}

const SCANNER_ID = "camera-qr-region";

export function CameraScanner({ onScan, active }: CameraScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCamIdx, setCurrentCamIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  // Obtener lista de cámaras al montar
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices.length > 0) {
          setCameras(devices);
          // Preferir cámara trasera si hay varias
          const backIdx = devices.findIndex((d) =>
            /back|rear|environment/i.test(d.label)
          );
          if (backIdx >= 0) setCurrentCamIdx(backIdx);
        }
      })
      .catch(() => setError("No se pudo acceder a las cámaras"));
  }, []);

  // Iniciar/detener cámara según `active`
  useEffect(() => {
    if (!active || cameras.length === 0) return;

    const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });
    scannerRef.current = scanner;
    setError(null);
    setStarting(true);

    scanner
      .start(
        cameras[currentCamIdx].id,
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          onScanRef.current(decodedText.trim());
        },
        undefined
      )
      .then(() => setStarting(false))
      .catch((err) => {
        setError("No se pudo iniciar la cámara: " + (err?.message ?? err));
        setStarting(false);
      });

    return () => {
      if (
        scanner.getState() === Html5QrcodeScannerState.SCANNING ||
        scanner.getState() === Html5QrcodeScannerState.PAUSED
      ) {
        scanner.stop().catch(() => {});
      }
      scannerRef.current = null;
    };
  }, [active, cameras, currentCamIdx]);

  function switchCamera() {
    if (cameras.length < 2) return;
    setCurrentCamIdx((i) => (i + 1) % cameras.length);
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-red-400 text-sm text-center">
        <CameraOff size={32} />
        <p>{error}</p>
        <p className="text-xs text-gray-500">
          Asegúrate de dar permiso de cámara al navegador
        </p>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black">
      {/* Contenedor donde html5-qrcode inyecta el video */}
      <div id={SCANNER_ID} className="w-full" />

      {/* Overlay: esquinas decorativas */}
      {!starting && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-48 h-48 relative">
            {/* Esquinas */}
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

      {/* Botón cambiar cámara */}
      {cameras.length > 1 && !starting && (
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
