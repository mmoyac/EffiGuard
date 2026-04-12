import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { Asset } from "../../types";

interface Props {
  asset: Asset;
  onConfirm: (stockNuevo: number, observaciones: string) => Promise<void>;
  onClose: () => void;
}

export function AdjustModal({ asset, onConfirm, onClose }: Props) {
  const [stockNuevo, setStockNuevo] = useState(asset.stock_actual);
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);

  const diferencia = stockNuevo - asset.stock_actual;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(stockNuevo, observaciones);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md space-y-4 p-5 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-400">
            <SlidersHorizontal size={20} />
            <h3 className="font-bold text-base">Ajuste de stock</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm">
          <p className="text-gray-400">Activo</p>
          <p className="font-mono text-white font-semibold">{asset.uid_fisico}</p>
          <p className="text-xs text-gray-500 mt-0.5">Stock actual: <span className="text-white font-semibold">{asset.stock_actual}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Nuevo stock</label>
            <input
              type="number" min={0} required
              value={stockNuevo} onChange={(e) => setStockNuevo(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
            />
            {diferencia !== 0 && (
              <p className={`text-xs font-medium ${diferencia > 0 ? "text-green-400" : "text-red-400"}`}>
                {diferencia > 0 ? `+${diferencia} unidades` : `${diferencia} unidades`}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-400">Motivo del ajuste (opcional)</label>
            <textarea
              value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
              rows={2} placeholder="Ej: conteo físico, devolución de proveedor..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading || diferencia === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors min-h-[48px]">
              {loading ? "Guardando..." : "Aplicar ajuste"}
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
