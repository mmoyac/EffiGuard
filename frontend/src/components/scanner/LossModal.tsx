import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { Asset } from "../../types";

interface Props {
  asset: Asset;
  onConfirm: (cantidad: number, observaciones: string) => Promise<void>;
  onClose: () => void;
}

export function LossModal({ asset, onConfirm, onClose }: Props) {
  const isConsumable = asset.family.comportamiento === "consumible";
  const [cantidad, setCantidad] = useState(1);
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(cantidad, observaciones);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-red-800/50 rounded-2xl w-full max-w-md space-y-4 p-5 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={20} />
            <h3 className="font-bold text-base">Reportar pérdida</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm">
          <p className="text-gray-400">Activo</p>
          <p className="font-mono text-white font-semibold">{asset.uid_fisico}</p>
          <p className="text-xs text-gray-500 mt-0.5">{asset.family.nombre}</p>
        </div>

        {!isConsumable && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
            El activo quedará marcado como <strong>Robado / Perdido</strong> y no podrá ser prestado.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isConsumable && (
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Cantidad perdida</label>
              <input
                type="number" min={1} max={asset.stock_actual} required
                value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500"
              />
              <p className="text-xs text-gray-500">Stock actual: {asset.stock_actual}</p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-gray-400">Observaciones (opcional)</label>
            <textarea
              value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
              rows={2} placeholder="Ej: se cayó al vacío, robo en terreno..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors min-h-[48px]">
              {loading ? "Registrando..." : "Confirmar pérdida"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-3 rounded-xl text-sm text-gray-400 hover:bg-gray-800 transition-colors min-h-[48px]">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
