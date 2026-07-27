import { useState } from "react";
import { X, Undo2, User, FolderOpen, Loader2, Minus, Plus, AlertTriangle } from "lucide-react";
import type { Asset, DespachoPendiente } from "../../types";
import { abrevUnidad, esMedidaContinua, formatStock, unidadPlural } from "../../utils/cantidad";

interface Props {
  asset: Asset;
  despachos: DespachoPendiente[];
  onConfirm: (origenLogId: number, cantidad: number, observaciones: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Devuelve al stock el material despachado que no se consumió.
 *
 * Se elige contra qué despacho vuelve: eso es lo que permite validar que no se
 * reintegre más de lo que salió, y calcular el consumo real del proyecto —
 * despachado menos devuelto— en vez de suponer que todo lo retirado se gastó.
 */
export function ReintegroModal({ asset, despachos, onConfirm, onClose }: Props) {
  const admiteDecimales = esMedidaContinua(asset.unidad);
  const paso = admiteDecimales ? 0.5 : 1;
  const minCantidad = admiteDecimales ? 0.001 : 1;
  const redondear = (v: number) => Math.round(v * 1000) / 1000;

  const [seleccionado, setSeleccionado] = useState<DespachoPendiente | null>(
    despachos.length === 1 ? despachos[0] : null
  );
  const [cantidad, setCantidad] = useState(1);
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const saldo = seleccionado?.saldo_pendiente ?? 0;
  const cantidadOk = cantidad >= minCantidad && cantidad <= saldo;

  async function handleConfirm() {
    if (!seleccionado || !cantidadOk) return;
    setLoading(true);
    setError("");
    try {
      await onConfirm(seleccionado.despacho_id, cantidad, observaciones);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error al registrar el reintegro");
    } finally {
      setLoading(false);
    }
  }

  function fecha(iso: string) {
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="min-w-0">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Undo2 size={18} className="text-cyan-400" /> Reintegrar sobrante
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{asset.uid_fisico}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Elegir despacho */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">¿De qué entrega vuelve el material?</label>
            <p className="text-xs text-gray-500 mb-3">
              Estas son las entregas con material que todavía no vuelve a bodega
            </p>
            <ul className="space-y-2">
              {despachos.map((d) => {
                const activo = seleccionado?.despacho_id === d.despacho_id;
                return (
                  <li key={d.despacho_id}>
                    <button
                      onClick={() => { setSeleccionado(d); setCantidad(Math.min(1, d.saldo_pendiente)); }}
                      className={`w-full text-left rounded-xl p-4 border transition-colors min-h-[48px] ${
                        activo
                          ? "bg-cyan-900/25 border-cyan-600"
                          : "bg-gray-700/50 border-gray-600 hover:bg-gray-700"
                      }`}
                    >
                      {/* Primero quién y cuándo: es lo que identifica la entrega */}
                      <div className="space-y-1 text-xs text-gray-400 mb-3">
                        {d.operario_nombre && (
                          <p className="flex items-center gap-1.5 truncate text-sm text-white font-medium">
                            <User size={13} className="flex-shrink-0 text-gray-400" /> {d.operario_nombre}
                          </p>
                        )}
                        <p className="flex items-center gap-1.5 truncate">
                          {d.proyecto_nombre && (
                            <>
                              <FolderOpen size={12} className="flex-shrink-0" /> {d.proyecto_nombre} ·{" "}
                            </>
                          )}
                          {fecha(d.fecha_hora)}
                        </p>
                      </div>

                      {/* Después los números, con la etiqueta que dice qué son */}
                      <div className="flex items-end justify-between gap-3 border-t border-gray-600/60 pt-3">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">Se llevó</p>
                          <p className="text-sm font-semibold text-gray-300">
                            {formatStock(d.cantidad_despachada, asset.unidad)}
                          </p>
                          {Number(d.cantidad_reintegrada) > 0 && (
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              ya devolvió {formatStock(d.cantidad_reintegrada, asset.unidad)}
                            </p>
                          )}
                        </div>
                        <div className="text-right min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-cyan-500">Sin devolver</p>
                          <p className="text-xl font-bold text-cyan-300">
                            {formatStock(d.saldo_pendiente, asset.unidad)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Cantidad */}
          {seleccionado && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Cantidad que vuelve <span className="text-gray-400 font-normal">(en {unidadPlural(asset.unidad)})</span>
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCantidad((c) => Math.max(minCantidad, redondear(c - paso)))}
                  className="flex-none w-14 h-14 bg-gray-700 hover:bg-gray-600 rounded-xl flex items-center justify-center text-white transition-colors min-h-[48px]"
                >
                  <Minus size={22} />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min={minCantidad}
                    max={saldo}
                    step={paso}
                    value={cantidad}
                    onChange={(e) => {
                      const v = admiteDecimales ? parseFloat(e.target.value) : parseInt(e.target.value);
                      setCantidad(isNaN(v) ? minCantidad : Math.max(minCantidad, v));
                    }}
                    className="w-full bg-gray-700 text-white text-center text-3xl font-bold rounded-xl px-4 py-3 min-h-[56px] border border-gray-600 focus:border-cyan-500 focus:outline-none"
                  />
                  {abrevUnidad(asset.unidad) && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-semibold pointer-events-none">
                      {abrevUnidad(asset.unidad)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setCantidad((c) => Math.min(saldo, redondear(c + paso)))}
                  className="flex-none w-14 h-14 bg-gray-700 hover:bg-gray-600 rounded-xl flex items-center justify-center text-white transition-colors min-h-[48px]"
                >
                  <Plus size={22} />
                </button>
              </div>
              {cantidad > saldo && (
                <p className="text-red-400 text-sm mt-2">
                  No puede volver más de lo que salió (máx. {formatStock(saldo, asset.unidad)})
                </p>
              )}
              {/* La operación no se puede deshacer: la consecuencia completa se
                  muestra antes, no se descubre después */}
              {cantidadOk && (
                <div className="mt-3 bg-gray-700/50 border border-gray-600 rounded-xl p-3 space-y-1.5 text-xs">
                  <p className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Vuelven al stock</span>
                    <span className="text-cyan-300 font-bold">
                      {formatStock(cantidad, asset.unidad)}
                    </span>
                  </p>
                  <p className="flex items-center justify-between gap-2">
                    <span className="text-gray-400 truncate">
                      Consumo{seleccionado.proyecto_nombre ? ` de ${seleccionado.proyecto_nombre}` : ""}
                    </span>
                    <span className="text-gray-200 font-bold flex-shrink-0">
                      {formatStock(redondear(saldo - cantidad), asset.unidad)}
                    </span>
                  </p>
                  <p className="flex items-start gap-1.5 text-amber-400/90 pt-1.5 border-t border-gray-600/60">
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                    Esta entrega se cierra. No se puede deshacer.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Observaciones */}
          {seleccionado && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Observaciones (opcional)</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                placeholder="Ej: sobrante en buen estado"
                className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 border border-gray-600 focus:border-cyan-500 focus:outline-none resize-none text-sm"
              />
            </div>
          )}
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
            disabled={!seleccionado || !cantidadOk || loading}
            className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3 min-h-[48px] transition-colors"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Undo2 size={18} />}
            {loading
              ? "Procesando..."
              : !seleccionado
                // Con varias entregas no se autoselecciona: el botón debe decir
                // qué falta, no una cantidad que aún no aplica a nada
                ? "Elige una entrega"
                : `Reintegrar ${formatStock(cantidad, asset.unidad)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
