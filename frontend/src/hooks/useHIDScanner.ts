import { useEffect, useRef, useState } from "react";

interface UseHIDScannerOptions {
  /** Tiempo máximo entre keystrokes para considerarlos parte del mismo escaneo (ms) */
  timeout?: number;
  /** Longitud mínima para considerar el buffer un escaneo válido */
  minLength?: number;
  onScan: (uid: string) => void;
}

/**
 * Captura input de lectores RFID/QR externos que emulan teclado HID.
 * Diferencia escaneos (ráfagas rápidas de chars + Enter) de tipado manual.
 *
 * Estrategia:
 *  - Los lectores HID emiten todos los chars en < ~50ms y terminan con Enter.
 *  - Si el tiempo entre keystrokes supera `timeout`, se descarta el buffer
 *    (el usuario estaba escribiendo manualmente).
 */
export function useHIDScanner({ timeout = 80, minLength = 4, onScan }: UseHIDScannerOptions) {
  const bufferRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function flush() {
      const uid = bufferRef.current.trim();
      bufferRef.current = "";
      if (uid.length >= minLength) onScan(uid);
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Ignorar si el foco está en un input/textarea (usuario escribe manualmente)
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (timerRef.current) clearTimeout(timerRef.current);

      if (e.key === "Enter") {
        flush();
        return;
      }

      // Solo acumular caracteres imprimibles
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        // Auto-flush si el lector no manda Enter (algunos modelos no lo hacen)
        timerRef.current = setTimeout(flush, timeout * 3);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeout, minLength, onScan]);
}

/**
 * Versión como componente de estado: retorna el último UID escaneado
 * y una función para resetearlo.
 */
export function useLastScan(options?: Omit<UseHIDScannerOptions, "onScan">) {
  const [lastUid, setLastUid] = useState<string | null>(null);

  useHIDScanner({
    ...options,
    onScan: setLastUid,
  });

  return { lastUid, reset: () => setLastUid(null) };
}
