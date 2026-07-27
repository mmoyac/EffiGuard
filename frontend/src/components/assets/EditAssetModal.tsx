import { useState } from "react";
import { Settings2, X, Package } from "lucide-react";
import { assetsApi } from "../../services/api";
import type { Asset, UnidadMedida } from "../../types";
import { UbicacionPicker } from "./UbicacionPicker";

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
    codigo_fabricante: asset.codigo_fabricante ?? "",
    unidad: asset.unidad ?? "unidad",
    contenido_por_empaque: asset.contenido_por_empaque ? String(asset.contenido_por_empaque) : "",
    nombre_empaque: asset.nombre_empaque ?? "",
    precio_compra: asset.precio_compra ? String(asset.precio_compra) : "",
  });
  const [ubicacionId, setUbicacionId] = useState<number | null>(asset.ubicacion_id);
  // Derivado: no se guarda el precio del empaque, se calcula desde el unitario
  const [precioEmpaque, setPrecioEmpaque] = useState(
    asset.precio_compra && asset.contenido_por_empaque
      ? String(Number(asset.precio_compra) * Number(asset.contenido_por_empaque))
      : ""
  );
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
        ubicacion_id: ubicacionId,
        codigo_fabricante: form.codigo_fabricante.trim() || null,
        // El empaque sólo aplica a consumibles: en una herramienta no significa nada
        ...(isConsumable
          ? {
              unidad: form.unidad,
              contenido_por_empaque: form.contenido_por_empaque ? Number(form.contenido_por_empaque) : null,
              nombre_empaque: form.nombre_empaque.trim() || null,
              precio_compra: form.precio_compra ? Number(form.precio_compra) : null,
            }
          : {}),
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

          {/* Ubicación en bodega */}
          <UbicacionPicker actual={asset.ubicacion} value={ubicacionId} onChange={setUbicacionId} />

          {/* Código de barras del fabricante */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">
              Código de fabricante <span className="text-gray-500 font-normal">(opcional)</span>
            </label>
            <p className="text-xs text-gray-500">
              EAN/UPC de la caja. Identifica el producto, no esta unidad: las unidades iguales lo comparten.
            </p>
            <input placeholder="7891234567890" value={form.codigo_fabricante}
              onChange={(e) => setForm({ ...form, codigo_fabricante: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          </div>

          {/* Consumible: unidad, stock mínimo y empaque */}
          {isConsumable && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">Unidad de medida</label>
                <p className="text-xs text-gray-500">En qué se despacha: la unidad en que vive el stock</p>
                <select value={form.unidad}
                  onChange={(e) => setForm({ ...form, unidad: e.target.value as UnidadMedida })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value="unidad">Unidad (tornillos, guantes)</option>
                  <option value="metro">Metro (cable, luces LED)</option>
                  <option value="kilo">Kilo</option>
                  <option value="litro">Litro</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">Cantidad mínima</label>
                <p className="text-xs text-gray-500">Alerta de stock bajo si cae por debajo de este número</p>
                <input type="number" min={0} value={form.stock_minimo}
                  onChange={(e) => setForm({ ...form, stock_minimo: Number(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>

              {/* Empaque de compra: se compra en cajas, se despacha en unidades */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">
                  Empaque de compra <span className="text-gray-500 font-normal">(opcional)</span>
                </label>
                <p className="text-xs text-gray-500">
                  Si compras por caja o rollo, la compra se ingresa en empaques y el stock sube en unidades.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min={0} step="any" placeholder="Contenido (100)"
                    value={form.contenido_por_empaque}
                    onChange={(e) => setForm({ ...form, contenido_por_empaque: e.target.value })}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
                  <input placeholder="Nombre (caja)" value={form.nombre_empaque}
                    onChange={(e) => setForm({ ...form, nombre_empaque: e.target.value })}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
                </div>
                {Number(form.contenido_por_empaque) > 0 && (
                  <p className="text-xs text-green-400 pt-1">
                    1 {form.nombre_empaque.trim() || "empaque"} = {form.contenido_por_empaque} {form.unidad}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">
                  Precio de compra <span className="text-gray-500 font-normal">(opcional)</span>
                </label>
                <p className="text-xs text-gray-500">
                  Costo de UNA {form.unidad}. Valoriza el consumo del proyecto.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min={0} step="any" placeholder="Precio unitario"
                    value={form.precio_compra}
                    onChange={(e) => {
                      setForm({ ...form, precio_compra: e.target.value });
                      const cont = Number(form.contenido_por_empaque);
                      setPrecioEmpaque(cont > 0 && e.target.value ? String(Number(e.target.value) * cont) : "");
                    }}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
                  <input type="number" min={0} step="any" placeholder={`Precio por ${form.nombre_empaque.trim() || "empaque"}`}
                    value={precioEmpaque}
                    onChange={(e) => {
                      setPrecioEmpaque(e.target.value);
                      const cont = Number(form.contenido_por_empaque);
                      if (cont > 0 && e.target.value) {
                        setForm((f) => ({ ...f, precio_compra: String(Number(e.target.value) / cont) }));
                      }
                    }}
                    disabled={!(Number(form.contenido_por_empaque) > 0)}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full disabled:opacity-40" />
                </div>
                {Number(form.precio_compra) > 0 && (
                  <p className="text-xs text-green-400 pt-1">
                    {Number(form.precio_compra).toLocaleString("es-CL", { maximumFractionDigits: 4 })} por {form.unidad}
                  </p>
                )}
              </div>

            </>
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
