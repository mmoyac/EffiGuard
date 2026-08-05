/**
 * Captura del `uid_credencial` de un usuario.
 *
 * Vive acá y no en `components/scanner/` porque los mantenedores de usuarios lo
 * usan y no tienen nada que ver con el escáner de catálogo; ni en
 * `components/catalogo/shared.tsx`, porque un mantenedor importando del catálogo
 * es la dependencia cruzada que ese mismo archivo documenta querer evitar.
 *
 * Existe porque esto estaba copiado a mano en siete lugares y divergió: el
 * refactor del catálogo reescribió los modales de despacho desde cero y la
 * lectura NFC se perdió en tres pantallas sin que nada fallara.
 */
import { useState } from "react";
import { RefreshCw, Wifi, X } from "lucide-react";
import { NFCScanner } from "../scanner/NFCScanner";

const INPUT =
  "bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 flex-1 min-w-0 font-mono min-h-[48px]";
const BOTON =
  "px-3 rounded-xl border transition-colors flex items-center justify-center flex-shrink-0 min-h-[48px]";
const BOTON_APAGADO =
  "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white";

/** Genera un UID corto con prefijo, sin caracteres ambiguos (0/O, 1/I/L) */
export function generateUid(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const code = Array.from(array).map((b) => chars[b % chars.length]).join("");
  return `${prefix}-${code}`;
}

/**
 * El backend resuelve la credencial por coincidencia exacta, así que el alta y la
 * lectura tienen que normalizar igual o se registra un UID que después no se
 * encuentra. Sólo se recorta: pasar a mayúsculas lo tecleado rompería cualquier
 * credencial ya almacenada en minúsculas.
 */
export function normalizarUid(uid: string): string {
  return uid.trim();
}

/**
 * El serial del tag sí se sube a mayúsculas, en el único punto donde nace. Es
 * el mismo trato al darlo de alta y al leerlo en despacho, que es donde la
 * coincidencia importa.
 */
function normalizarUidNfc(uid: string): string {
  return uid.trim().toUpperCase();
}

interface CampoCredencialProps {
  /** Texto del input, controlado por el llamador */
  valor: string;
  onChange: (valor: string) => void;
  /**
   * UID confirmado: Enter, lectura NFC o Generar. Acá divergen los dos modos de
   * uso — el mantenedor lo escribe en su formulario, el despacho lo resuelve
   * contra `GET /users/scan/{uid}`.
   */
  onCapturar: (uid: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  /** Los mantenedores emiten credenciales; el despacho no */
  permitirGenerar?: boolean;
  permitirLimpiar?: boolean;
  autoFocus?: boolean;
}

export function CampoCredencial({
  valor,
  onChange,
  onCapturar,
  label,
  placeholder = "Acerca la credencial o el QR…",
  error,
  permitirGenerar = false,
  permitirLimpiar = false,
  autoFocus = false,
}: CampoCredencialProps) {
  // El lector NFC se monta sólo al pedirlo: dejarlo abierto todo el turno gasta
  // batería y captura tags al apoyar el teléfono en el mesón.
  const [nfcAbierto, setNfcAbierto] = useState(false);

  function capturar(uid: string) {
    const limpio = normalizarUid(uid);
    if (!limpio) return;
    onCapturar(limpio);
  }

  return (
    <div className="space-y-1.5 min-w-0">
      {label && <label className="text-xs text-gray-400">{label}</label>}

      <div className="flex gap-2 min-w-0">
        {/*
         * Un input de verdad, con foco: el capturador HID global ignora las teclas
         * mientras el foco está en un input, y por eso la ráfaga del lector cae
         * acá en vez de interpretarse como un código de producto.
         */}
        <input
          className={INPUT}
          placeholder={placeholder}
          autoFocus={autoFocus}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              capturar(valor);
            }
          }}
        />

        <button
          type="button"
          title="Escanear tarjeta Bip! u otra tarjeta NFC"
          onClick={() => setNfcAbierto((v) => !v)}
          className={`${BOTON} ${
            nfcAbierto ? "bg-green-600 border-green-500 text-white" : BOTON_APAGADO
          }`}
        >
          <Wifi size={15} />
        </button>

        {permitirGenerar && (
          <button
            type="button"
            title="Generar credencial automática"
            onClick={() => {
              setNfcAbierto(false);
              onCapturar(generateUid("USR"));
            }}
            className={`${BOTON} ${BOTON_APAGADO}`}
          >
            <RefreshCw size={15} />
          </button>
        )}

        {permitirLimpiar && valor && (
          <button
            type="button"
            title="Quitar credencial"
            onClick={() => {
              setNfcAbierto(false);
              onChange("");
            }}
            className={`${BOTON} bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600 hover:text-red-400`}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {nfcAbierto && (
        <NFCScanner
          active={nfcAbierto}
          onScan={(uid) => {
            setNfcAbierto(false);
            onCapturar(normalizarUidNfc(uid));
          }}
        />
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
