import { useState } from "react";
import { Trash2, X } from "lucide-react";
import type { Asset } from "../../types";

interface Props {
  asset: Asset;
  onConfirm: (cantidad: number, observaciones: string) => Promise<void>;
  onClose: () => void;
}

export function MermaModal({ asset, onConfirm, onClose }: Props) {
  const [cantidad, setCantidad] = useState(1);
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cantidad > asset.stock_actual) {
      setError(`Stock insuficiente. Disponible: ${asset.stock_actual}`);
      return;
    }
    setLoading(true);
    try {
      await onConfirm(cantidad, observaciones);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error al registrar merma");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md space-y-4 p-5 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400">
            <Trash2 size={20} />
            <h3 className="font-bold text-base">Registrar merma</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm space-y-0.5">
          {asset.nombre && <p className="text-white font-semibold">{asset.nombre}</p>}
          <p className="font-mono text-gray-400 text-xs">{asset.uid_fisico}</p>
          <p className="text-xs text-gray-500 pt-1">
            Stock actual: <span className="text-white font-semibold">{asset.stock_actual}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-xl">{error}</p>
          )}

          <div className="space-y-2">
            <label className="text-xs text-gray-400">Unidades a dar de baja</label>
            <div className="flex items-center justify-center gap-4">
              <button type="button"
                onClick={() => { setCantidad((q) => Math.max(1, q - 1)); setError(""); }}
                className="w-12 h-12 rounded-2xl bg-gray-700 hover:bg-gray-600 text-white text-2xl font-bold flex items-center justify-center transition-colors active:scale-95">
                −
              </button>
              <span className="text-4xl font-bold text-white w-16 text-center tabular-nums">{cantidad}</span>
              <button type="button"
                onClick={() => { setCantidad((q) => Math.min(asset.stock_actual, q + 1)); setError(""); }}
                className="w-12 h-12 rounded-2xl bg-gray-700 hover:bg-gray-600 text-white text-2xl font-bold flex items-center justify-center transition-colors active:scale-95">
                +
              </button>
            </div>
            <p className="text-center text-xs text-gray-500">
              Quedará: <span className="text-white font-semibold">{asset.stock_actual - cantidad}</span> unidades
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-400">Motivo (opcional)</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Ej: producto vencido, dañado en bodega, corrección de conteo…"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 resize-none placeholder-gray-600"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors min-h-[48px]">
              {loading ? "Guardando..." : `Dar de baja ${cantidad} unidad${cantidad !== 1 ? "es" : ""}`}
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
