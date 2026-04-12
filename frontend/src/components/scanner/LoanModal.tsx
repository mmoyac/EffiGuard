import { useEffect, useRef, useState } from "react";
import { useQuery } from "react-query";
import { X, ArrowRight, ScanLine, CheckCircle2, XCircle, Loader2, UserCheck } from "lucide-react";
import { usersApi, projectsApi } from "../../services/api";
import type { Asset, User } from "../../types";

interface Project { id: number; nombre: string; is_active: boolean }

interface Props {
  asset: Asset;
  kitChildren?: Asset[];
  onConfirm: (userId: number, projectId: number | null) => Promise<void>;
  onClose: () => void;
}

type ScanState = "idle" | "loading" | "found" | "not_found";

export function LoanModal({ asset, kitChildren = [], onConfirm, onClose }: Props) {
  const [credInput, setCredInput] = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [resolvedUser, setResolvedUser] = useState<User | null>(null);
  const [projectId, setProjectId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualUserId, setManualUserId] = useState<number | "">("");

  const inputRef = useRef<HTMLInputElement>(null);

  const isKit = kitChildren.length > 0;

  const { data: users = [] } = useQuery<User[]>("users", () =>
    usersApi.list().then((r) => r.data),
    { enabled: showManual }
  );
  const { data: projects = [] } = useQuery<Project[]>("projects", () =>
    projectsApi.list().then((r) => r.data)
  );

  // Auto-focus al input de credencial al abrir
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

  function resetOperario() {
    setResolvedUser(null);
    setScanState("idle");
    setCredInput("");
    setManualUserId("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const effectiveUserId = resolvedUser?.id ?? (showManual ? manualUserId : "");

  async function handleConfirm() {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      await onConfirm(Number(effectiveUserId), projectId ? Number(projectId) : null);
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
            <h2 className="text-lg font-bold">
              {isKit ? "Préstamo de Kit" : "Préstamo de Herramienta"}
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{asset.uid_fisico}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* Kit items */}
        {isKit && (
          <div className="px-5 py-3 bg-blue-900/20 border-b border-gray-700">
            <p className="text-xs text-blue-400 font-semibold mb-2">Ítems del kit ({kitChildren.length + 1})</p>
            <ul className="space-y-1">
              <li className="text-xs text-gray-300 font-mono">▸ {asset.uid_fisico} (padre)</li>
              {kitChildren.map((c) => (
                <li key={c.id} className="text-xs text-gray-400 font-mono ml-3">▸ {c.uid_fisico}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-5 space-y-4">

          {/* Sección operario */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <UserCheck size={15} className="text-blue-400" />
              Confirmar recepción — Operario *
            </label>

            {/* Estado: no resuelto aún */}
            {scanState !== "found" && (
              <div className="space-y-2">
                <div className="relative">
                  <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={credInput}
                    onChange={(e) => {
                      setCredInput(e.target.value);
                      setScanState("idle");
                    }}
                    onKeyDown={handleCredKeyDown}
                    placeholder="Escanea credencial del operario..."
                    className="w-full bg-gray-700 text-white rounded-xl pl-9 pr-24 py-3 min-h-[48px] border border-gray-600 focus:border-blue-500 focus:outline-none text-sm placeholder:text-gray-500"
                  />
                  <button
                    onClick={() => resolveCredential(credInput)}
                    disabled={!credInput.trim() || scanState === "loading"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {scanState === "loading"
                      ? <Loader2 size={14} className="animate-spin" />
                      : "Verificar"}
                  </button>
                </div>

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
                    className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 min-h-[48px] border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                  >
                    <option value="">Seleccionar operario...</option>
                    {users
                      .filter((u) => u.role_id !== 1)
                      .map((u) => (
                        <option key={u.id} value={u.id}>{u.nombre} — {u.rut}</option>
                      ))}
                  </select>
                )}
              </div>
            )}

            {/* Estado: resuelto */}
            {scanState === "found" && resolvedUser && (
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
          </div>

          {/* Proyecto */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Proyecto (opcional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 min-h-[48px] border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
            >
              <option value="">Sin proyecto</option>
              {projects.filter((p) => p.is_active).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
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
            disabled={!effectiveUserId || loading}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3 min-h-[48px] transition-colors"
          >
            {loading ? "Procesando..." : (<><ArrowRight size={18} /> Entregar</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
