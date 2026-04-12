import { useState } from "react";
import { useQuery } from "react-query";
import { X, Minus, Plus, ArrowRight } from "lucide-react";
import { usersApi } from "../../services/api";
import type { Asset, User } from "../../types";

interface Props {
  asset: Asset;
  onConfirm: (cantidad: number, observaciones: string, operarioId: number) => Promise<void>;
  onClose: () => void;
}

export function ConsumableModal({ asset, onConfirm, onClose }: Props) {
  const [cantidad, setCantidad] = useState(1);
  const [operarioId, setOperarioId] = useState<number | "">("");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: users = [] } = useQuery<User[]>("users", () =>
    usersApi.list().then((r) => r.data)
  );

  const stockOk = cantidad <= asset.stock_actual;

  async function handleConfirm() {
    if (!stockOk || cantidad < 1 || !operarioId) return;
    setLoading(true);
    try {
      await onConfirm(cantidad, observaciones, Number(operarioId));
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
            <label className="block text-sm font-medium text-gray-300 mb-2">Operario que retira *</label>
            <select
              value={operarioId}
              onChange={(e) => setOperarioId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 min-h-[48px] border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Seleccionar operario...</option>
              {users
                .filter((u) => u.role_id !== 1)
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
            </select>
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
                className="flex-1 bg-gray-700 text-white text-center text-3xl font-bold rounded-xl px-4 py-3 min-h-[56px] border border-gray-600 focus:border-blue-500 focus:outline-none"
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

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Ej: Obra Norte, Piso 3..."
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 border border-gray-600 focus:border-blue-500 focus:outline-none resize-none text-sm"
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
            disabled={!stockOk || cantidad < 1 || !operarioId || loading}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3 min-h-[48px] transition-colors"
          >
            {loading ? "Procesando..." : (<><ArrowRight size={18} /> Retirar {cantidad}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
