import { useState } from "react";
import { Settings2, X, Package } from "lucide-react";
import { assetsApi } from "../../services/api";
import type { Asset } from "../../types";

interface State { id: number; nombre: string; }
interface AssetModel { id: number; brand_id: number; nombre: string; }
interface Brand { id: number; nombre: string; }

interface Props {
  asset: Asset;
  states: State[];
  models: AssetModel[];
  brands: Brand[];
  onSaved: () => void;
  onClose: () => void;
}

export function EditAssetModal({ asset, states, models, brands, onSaved, onClose }: Props) {
  const isConsumable = asset.family.comportamiento === "consumible";
  const [form, setForm] = useState({
    nombre: asset.nombre ?? "",
    model_id: asset.model_id ? String(asset.model_id) : "",
    estado_id: asset.estado_id,
    stock_minimo: asset.stock_minimo,
    valor_reposicion: asset.valor_reposicion ? String(asset.valor_reposicion) : "",
    proxima_mantencion: asset.proxima_mantencion ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Stock adjustment state (consumables only)
  const [stockNuevo, setStockNuevo] = useState<string>("");
  const [adjustObs, setAdjustObs] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState("");
  const stockDiff = Number(stockNuevo) - asset.stock_actual;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await assetsApi.update(asset.id, {
        nombre: form.nombre.trim() || null,
        model_id: form.model_id ? Number(form.model_id) : null,
        estado_id: Number(form.estado_id),
        stock_minimo: Number(form.stock_minimo),
        valor_reposicion: form.valor_reposicion ? Number(form.valor_reposicion) : null,
        proxima_mantencion: form.proxima_mantencion || null,
      });
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjust() {
    if (stockNuevo === "" || isNaN(Number(stockNuevo))) return;
    setAdjusting(true);
    setAdjustError("");
    try {
      await assetsApi.adjustStock(asset.id, {
        stock_nuevo: Number(stockNuevo),
        observaciones: adjustObs.trim() || null,
      });
      onSaved();
    } catch (err: any) {
      setAdjustError(err?.response?.data?.detail ?? "Error al ajustar stock");
    } finally {
      setAdjusting(false);
    }
  }

  const model = models.find((m) => m.id === asset.model_id);
  const brand = model ? brands.find((b) => b.id === model.brand_id) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md animate-in slide-in-from-bottom duration-200 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2 text-white">
            <Settings2 size={18} className="text-blue-400" />
            <h3 className="font-bold text-base">Editar activo</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Info del activo */}
        <div className="px-5 py-3 bg-gray-800/50 border-b border-gray-800">
          <p className="font-mono text-sm text-white font-semibold">{asset.uid_fisico}</p>
          {asset.nombre && <p className="text-sm text-blue-300 font-medium mt-0.5">{asset.nombre}</p>}
          <p className="text-xs text-gray-500 mt-0.5 capitalize">
            {brand?.nombre} {model?.nombre ?? "—"} · {asset.family.nombre}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{error}</p>}

          {/* Nombre */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">
              Nombre <span className="text-gray-500 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder={isConsumable ? "Ej: Clavos 3 pulgadas" : "Ej: Taladro grande bodega norte"}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Modelo */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">
              Modelo {isConsumable && <span className="text-gray-500 font-normal">(opcional)</span>}
            </label>
            <select
              value={form.model_id}
              onChange={(e) => setForm({ ...form, model_id: e.target.value })}
              required={!isConsumable}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Sin modelo</option>
              {brands.map((b) => (
                <optgroup key={b.id} label={b.nombre}>
                  {models.filter((m) => m.brand_id === b.id).map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">Estado</label>
            <select value={form.estado_id}
              onChange={(e) => setForm({ ...form, estado_id: Number(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
              {states.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          {/* Consumible: stock mínimo */}
          {isConsumable && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300">Cantidad mínima</label>
              <p className="text-xs text-gray-500">Alerta de stock bajo si cae por debajo de este número</p>
              <input type="number" min={0} value={form.stock_minimo}
                onChange={(e) => setForm({ ...form, stock_minimo: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          )}

          {/* Valor reposición */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">Valor de reposición <span className="text-gray-500 font-normal">(opcional)</span></label>
            <p className="text-xs text-gray-500">Costo aproximado si se pierde o daña</p>
            <input type="number" min={0} placeholder="$0" value={form.valor_reposicion}
              onChange={(e) => setForm({ ...form, valor_reposicion: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          </div>

          {/* Herramienta: próxima mantención */}
          {!isConsumable && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300">Próxima mantención <span className="text-gray-500 font-normal">(opcional)</span></label>
              <p className="text-xs text-gray-500">Fecha programada para revisión preventiva</p>
              <input type="date" value={form.proxima_mantencion}
                onChange={(e) => setForm({ ...form, proxima_mantencion: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          )}

          {/* Stock adjustment — consumables only */}
          {isConsumable && (
            <div className="border border-gray-700 rounded-xl p-4 space-y-3 bg-gray-800/30">
              <div className="flex items-center gap-2 text-gray-300">
                <Package size={15} className="text-green-400" />
                <span className="text-xs font-semibold uppercase tracking-wide">Ajustar stock</span>
                <span className="ml-auto text-xs text-gray-500">
                  Actual: <span className="text-white font-semibold">{asset.stock_actual}</span>
                </span>
              </div>

              {adjustError && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{adjustError}</p>}

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  value={stockNuevo}
                  onChange={(e) => setStockNuevo(e.target.value)}
                  className="w-28 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-green-500"
                />
                {stockNuevo !== "" && !isNaN(Number(stockNuevo)) && stockDiff !== 0 && (
                  <span className={`text-sm font-semibold ${stockDiff > 0 ? "text-green-400" : "text-red-400"}`}>
                    {stockDiff > 0 ? `+${stockDiff}` : stockDiff}
                  </span>
                )}
              </div>

              <input
                type="text"
                value={adjustObs}
                onChange={(e) => setAdjustObs(e.target.value)}
                placeholder="Observación (opcional)"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
              />

              <button
                type="button"
                onClick={handleAdjust}
                disabled={adjusting || stockNuevo === "" || isNaN(Number(stockNuevo))}
                className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {adjusting ? "Ajustando..." : "Confirmar ajuste"}
              </button>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors min-h-[48px]">
              {saving ? "Guardando..." : "Guardar cambios"}
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
