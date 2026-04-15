import { useEffect, useRef, useState } from "react";
import { X, ScanLine, CheckCircle2, XCircle, Loader2, UserCheck, RotateCcw, AlertTriangle, Camera, Wifi, Wrench } from "lucide-react";
import { usersApi } from "../../services/api";
import { CameraScanner } from "./CameraScanner";
import { NFCScanner } from "./NFCScanner";
import type { Loan, User } from "../../types";

interface Props {
  activeLoan: Loan;
  onConfirm: (returningUserId: number, observaciones: string, sendToRepair: boolean) => Promise<void>;
  onClose: () => void;
}

type ScanState = "idle" | "loading" | "found" | "not_found";

export function ReturnModal({ activeLoan, onConfirm, onClose }: Props) {
  const [credInput, setCredInput] = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [resolvedUser, setResolvedUser] = useState<User | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [sendToRepair, setSendToRepair] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [nfcOpen, setNfcOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  async function resolveCredential(uid: string) {
    const trimmed = uid.trim();
    if (!trimmed) return;
    setScanState("loading");
    setResolvedUser(null);
    setMismatch(false);
    try {
      const { data } = await usersApi.scanByCredential(trimmed);
      if (data.id !== activeLoan.user_id) {
        setResolvedUser(data);
        setScanState("found");
        setMismatch(true);
      } else {
        setResolvedUser(data);
        setScanState("found");
        setMismatch(false);
      }
    } catch {
      setScanState("not_found");
    }
  }

  function handleCredKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      resolveCredential(credInput);
    }
  }

  function resetOperario() {
    setResolvedUser(null);
    setScanState("idle");
    setCredInput("");
    setMismatch(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleConfirm() {
    if (!resolvedUser || mismatch) return;
    setLoading(true);
    try {
      await onConfirm(resolvedUser.id, observaciones, sendToRepair);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold">Registrar Devolución</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Escanea la credencial del operario que devuelve
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info préstamo activo */}
        <div className="px-5 py-3 bg-blue-900/20 border-b border-gray-700">
          <p className="text-xs text-blue-400 font-semibold mb-1">Herramienta en terreno con:</p>
          <p className="text-sm font-semibold text-white">{activeLoan.user_nombre}</p>
          {activeLoan.user_rut && (
            <p className="text-xs text-gray-400">{activeLoan.user_rut}</p>
          )}
        </div>

        <div className="p-5 space-y-4">

          {/* Sección operario */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <UserCheck size={15} className="text-green-400" />
              Confirmar identidad del operario *
            </label>

            {scanState !== "found" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={credInput}
                      onChange={(e) => {
                        setCredInput(e.target.value);
                        setScanState("idle");
                        setMismatch(false);
                      }}
                      onKeyDown={handleCredKeyDown}
                      placeholder="Escanea credencial del operario..."
                      className="w-full bg-gray-700 text-white rounded-xl pl-9 pr-24 py-3 min-h-[48px] border border-gray-600 focus:border-green-500 focus:outline-none text-sm placeholder:text-gray-500"
                    />
                    <button
                      onClick={() => resolveCredential(credInput)}
                      disabled={!credInput.trim() || scanState === "loading"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {scanState === "loading"
                        ? <Loader2 size={14} className="animate-spin" />
                        : "Verificar"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCameraOpen((v) => !v); setNfcOpen(false); }}
                    className={`flex items-center justify-center w-12 min-h-[48px] rounded-xl border transition-colors ${
                      cameraOpen
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                    }`}
                    title="Escanear con cámara"
                  >
                    <Camera size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNfcOpen((v) => !v); setCameraOpen(false); }}
                    className={`flex items-center justify-center w-12 min-h-[48px] rounded-xl border transition-colors ${
                      nfcOpen
                        ? "bg-green-600 border-green-500 text-white"
                        : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                    }`}
                    title="Escanear con NFC"
                  >
                    <Wifi size={18} />
                  </button>
                </div>

                {cameraOpen && (
                  <CameraScanner
                    id="camera-qr-return"
                    active={cameraOpen}
                    onScan={(uid) => {
                      setCameraOpen(false);
                      setCredInput(uid);
                      resolveCredential(uid);
                    }}
                  />
                )}

                {nfcOpen && (
                  <NFCScanner
                    active={nfcOpen}
                    onScan={(uid) => {
                      setNfcOpen(false);
                      setCredInput(uid);
                      resolveCredential(uid);
                    }}
                  />
                )}

                {scanState === "not_found" && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5">
                    <XCircle size={13} /> Credencial no encontrada
                  </p>
                )}
              </div>
            )}

            {/* Operario resuelto — coincide */}
            {scanState === "found" && resolvedUser && !mismatch && (
              <div className="flex items-center justify-between bg-green-900/25 border border-green-700 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-white">{resolvedUser.nombre}</p>
                    <p className="text-xs text-gray-400">{resolvedUser.rut}</p>
                  </div>
                </div>
                <button
                  onClick={resetOperario}
                  className="text-gray-500 hover:text-gray-300 p-1.5 rounded-lg transition-colors"
                  title="Cambiar operario"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Operario resuelto — NO coincide */}
            {scanState === "found" && resolvedUser && mismatch && (
              <div className="space-y-2">
                <div className="flex items-start gap-3 bg-red-900/25 border border-red-700 rounded-xl px-4 py-3">
                  <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-300">Operario incorrecto</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Esta herramienta fue entregada a{" "}
                      <span className="text-white font-medium">{activeLoan.user_nombre}</span>.
                      Solo esa persona puede devolverla.
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetOperario}
                  className="text-xs text-gray-400 hover:text-gray-200 underline underline-offset-2 transition-colors"
                >
                  Intentar con otro operario
                </button>
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Observaciones (opcional)</label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Estado de la herramienta, notas..."
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 min-h-[48px] border border-gray-600 focus:border-green-500 focus:outline-none text-sm placeholder:text-gray-500"
            />
          </div>

          {/* Toggle reparación */}
          <button
            type="button"
            onClick={() => setSendToRepair((v) => !v)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
              sendToRepair
                ? "bg-yellow-900/30 border-yellow-700 text-yellow-300"
                : "bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-200"
            }`}
          >
            <Wrench size={16} className={sendToRepair ? "text-yellow-400" : "text-gray-500"} />
            <span className="flex-1 text-left text-sm font-medium">Enviar a reparación</span>
            <span className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${sendToRepair ? "bg-yellow-500" : "bg-gray-600"}`}>
              <span className={`w-4 h-4 rounded-full bg-white transition-transform shadow ${sendToRepair ? "translate-x-4" : "translate-x-0"}`} />
            </span>
          </button>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl px-4 py-3 min-h-[48px] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!resolvedUser || mismatch || loading}
            className={`flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3 min-h-[48px] transition-colors ${
              sendToRepair ? "bg-yellow-600 hover:bg-yellow-500" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {loading ? "Procesando..." : sendToRepair
              ? <><Wrench size={18} /> Devolver y enviar a reparación</>
              : <><RotateCcw size={18} /> Confirmar Devolución</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
