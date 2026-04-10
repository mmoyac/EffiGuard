import { useState } from "react";
import { useQuery } from "react-query";
import { X, ArrowRight } from "lucide-react";
import { usersApi, projectsApi } from "../../services/api";
import type { Asset, User } from "../../types";

interface Project { id: number; nombre: string; is_active: boolean }

interface Props {
  asset: Asset;
  /** Lista de activos hijos si es kit */
  kitChildren?: Asset[];
  onConfirm: (userId: number, projectId: number | null) => Promise<void>;
  onClose: () => void;
}

export function LoanModal({ asset, kitChildren = [], onConfirm, onClose }: Props) {
  const [userId, setUserId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  const { data: users = [] } = useQuery<User[]>("users", () =>
    usersApi.list().then((r) => r.data)
  );
  const { data: projects = [] } = useQuery<Project[]>("projects", () =>
    projectsApi.list().then((r) => r.data)
  );

  const isKit = kitChildren.length > 0;

  async function handleConfirm() {
    if (!userId) return;
    setLoading(true);
    try {
      await onConfirm(Number(userId), projectId ? Number(projectId) : null);
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
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center">
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

        {/* Formulario */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Operario que recibe *</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 min-h-[48px] border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Seleccionar operario...</option>
              {users
                .filter((u) => u.role_id !== 1) // excluir super_admin
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Proyecto (opcional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 min-h-[48px] border border-gray-600 focus:border-blue-500 focus:outline-none"
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
            disabled={!userId || loading}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3 min-h-[48px] transition-colors"
          >
            {loading ? "Procesando..." : (<><ArrowRight size={18} /> Entregar</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
