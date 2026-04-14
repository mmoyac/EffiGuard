import { useEffect, useRef, useState } from "react";
import { useQuery } from "react-query";
import { X, Minus, Plus, ArrowRight, ScanLine, CheckCircle2, XCircle, Loader2, UserCheck, Camera, Wifi } from "lucide-react";
import { usersApi, projectsApi } from "../../services/api";
import { CameraScanner } from "./CameraScanner";
import { NFCScanner } from "./NFCScanner";
import type { Asset, User } from "../../types";

interface Project { id: number; nombre: string; is_active: boolean }

interface Props {
  asset: Asset;
  onConfirm: (cantidad: number, observaciones: string, operarioId: number, projectId: number | null) => Promise<void>;
  onClose: () => void;
}

type ScanState = "idle" | "loading" | "found" | "not_found";

export function ConsumableModal({ asset, onConfirm, onClose }: Props) {
  const [cantidad, setCantidad] = useState(1);
  const [projectId, setProjectId] = useState<number | "">("");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);

  const [credInput, setCredInput] = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [resolvedUser, setResolvedUser] = useState<User | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualUserId, setManualUserId] = useState<number | "">("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [nfcOpen, setNfcOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const { data: users = [] } = useQuery<User[]>("users", () =>
    usersApi.list().then((r) => r.data),
    { enabled: showManual }
  );
  const { data: projects = [] } = useQuery<Project[]>("projects", () =>
    projectsApi.list().then((r) => r.data)
  );

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  async function resolveCredential(uid: string) {
    const trimmed = uid.trim();
    if (!trimmed) return;
    setScanState("loading");
    setResolvedUser(null);
    try {
      const { data } = await usersApi.scanByCredential(trimmed);
      setResolvedUser(data);
      setScanState("found");
      setShowManual(false);
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
    setManualUserId("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleManualSelect(uid: number | "") {
    setManualUserId(uid);
    if (uid) {
      const user = users.find((u) => u.id === uid);
      if (user) {
        setResolvedUser(user);
        setScanState("found");
        setCredInput(user.uid_credencial ?? "");
      }
    } else {
      setResolvedUser(null);
      setScanState("idle");
    }
  }

  const stockOk = cantidad <= asset.stock_actual;
  const effectiveUserId = resolvedUser?.id ?? (showManual ? manualUserId : "");

  async function handleConfirm() {
    if (!stockOk || cantidad < 1 || !effectiveUserId) return;
    setLoading(true);
    try {
      await onConfirm(cantidad, observaciones, Number(effectiveUserId), projectId ? Number(projectId) : null);
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
            <h2 className="text-lg font-bold">Retiro de Consumible</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{asset.uid_fisico}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stock actual */}
          <div className="bg-gray-700/50 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm text-gray-300">Stock disponible</span>
            <span className={`text-2xl font-bold ${asset.stock_actual <= asset.stock_minimo ? "text-yellow-400" : "text-green-400"}`}>
              {asset.stock_actual}
            </span>
          </div>

          {/* Operario */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <UserCheck size={15} className="text-orange-400" />
              Operario que retira *
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
                      onChange={(e) => { setCredInput(e.target.value); setScanState("idle"); }}
                      onKeyDown={handleCredKeyDown}
                      placeholder="Escanea credencial del operario..."
                      className="w-full bg-gray-700 text-white rounded-xl pl-9 pr-24 py-3 min-h-[48px] border border-gray-600 focus:border-orange-500 focus:outline-none text-sm placeholder:text-gray-500"
                    />
                    <button
                      onClick={() => resolveCredential(credInput)}
                      disabled={!credInput.trim() || scanState === "loading"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {scanState === "loading" ? <Loader2 size={14} className="animate-spin" /> : "Verificar"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCameraOpen((v) => !v); setNfcOpen(false); }}
                    className={`flex items-center justify-center w-12 min-h-[48px] rounded-xl border transition-colors ${cameraOpen ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"}`}
                    title="Escanear con cámara"
                  >
                    <Camera size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNfcOpen((v) => !v); setCameraOpen(false); }}
                    className={`flex items-center justify-center w-12 min-h-[48px] rounded-xl border transition-colors ${nfcOpen ? "bg-green-600 border-green-500 text-white" : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"}`}
                    title="Escanear con NFC"
                  >
                    <Wifi size={18} />
                  </button>
                </div>

                {cameraOpen && (
                  <CameraScanner
                    id="camera-qr-consumable"
                    active={cameraOpen}
                    onScan={(uid) => { setCameraOpen(false); setCredInput(uid); resolveCredential(uid); }}
                  />
                )}
                {nfcOpen && (
                  <NFCScanner
                    active={nfcOpen}
                    onScan={(uid) => { setNfcOpen(false); setCredInput(uid); resolveCredential(uid); }}
                  />
                )}

                {scanState === "not_found" && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5">
                    <XCircle size={13} /> Credencial no encontrada
                  </p>
                )}

                <button
                  onClick={() => setShowManual((v) => !v)}
                  className="text-xs text-gray-400 hover:text-gray-200 underline underline-offset-2 transition-colors"
                >
                  {showManual ? "Ocultar selección manual" : "Seleccionar operario manualmente"}
                </button>

                {showManual && (
                  <select
                    value={manualUserId}
                    onChange={(e) => handleManualSelect(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 min-h-[48px] border border-gray-600 focus:border-orange-500 focus:outline-none text-sm"
                  >
                    <option value="">Seleccionar operario...</option>
                    {users.filter((u) => u.role_id !== 1).map((u) => (
                      <option key={u.id} value={u.id}>{u.nombre} — {u.rut}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {scanState === "found" && resolvedUser && (
              <div className="flex items-center justify-between bg-green-900/25 border border-green-700 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-white">{resolvedUser.nombre}</p>
                    <p className="text-xs text-gray-400">{resolvedUser.rut}</p>
                  </div>
                </div>
                <button onClick={resetOperario} className="text-gray-500 hover:text-gray-300 p-1.5 rounded-lg transition-colors">
                  <X size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Selector de cantidad táctil */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Cantidad a retirar</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                className="flex-none w-14 h-14 bg-gray-700 hover:bg-gray-600 rounded-xl flex items-center justify-center text-white transition-colors min-h-[48px]"
              >
                <Minus size={22} />
              </button>
              <input
                type="number"
                min={1}
                max={asset.stock_actual}
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 bg-gray-700 text-white text-center text-3xl font-bold rounded-xl px-4 py-3 min-h-[56px] border border-gray-600 focus:border-orange-500 focus:outline-none"
              />
              <button
                onClick={() => setCantidad((c) => Math.min(asset.stock_actual, c + 1))}
                className="flex-none w-14 h-14 bg-gray-700 hover:bg-gray-600 rounded-xl flex items-center justify-center text-white transition-colors min-h-[48px]"
              >
                <Plus size={22} />
              </button>
            </div>
            {!stockOk && (
              <p className="text-red-400 text-sm mt-2">Stock insuficiente (máx. {asset.stock_actual})</p>
            )}
          </div>

          {/* Proyecto */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Proyecto (opcional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 min-h-[48px] border border-gray-600 focus:border-orange-500 focus:outline-none text-sm"
            >
              <option value="">Sin proyecto</option>
              {projects.filter((p) => p.is_active).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Ej: Obra Norte, Piso 3..."
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 border border-gray-600 focus:border-orange-500 focus:outline-none resize-none text-sm"
            />
          </div>
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
            disabled={!stockOk || cantidad < 1 || !effectiveUserId || loading}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3 min-h-[48px] transition-colors"
          >
            {loading ? "Procesando..." : (<><ArrowRight size={18} /> Retirar {cantidad}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
