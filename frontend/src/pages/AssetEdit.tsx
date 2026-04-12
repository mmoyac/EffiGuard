import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "react-query";
import { ArrowLeft, Package, Layers, Settings2, Package2 } from "lucide-react";
import { assetsApi, catalogApi } from "../services/api";
import type { Asset } from "../types";

interface State { id: number; nombre: string; }
interface AssetModel { id: number; brand_id: number; nombre: string; }
interface Brand { id: number; nombre: string; }

export function AssetEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: asset, isLoading } = useQuery<Asset>(
    ["asset", id],
    () => assetsApi.getById(Number(id)).then((r) => r.data),
    { enabled: !!id }
  );

  const { data: brands = [] } = useQuery<Brand[]>("catalog-brands", () =>
    catalogApi.brands().then((r) => r.data)
  );
  const { data: models = [] } = useQuery<AssetModel[]>("catalog-models", () =>
    catalogApi.models().then((r) => r.data)
  );
  const { data: states = [] } = useQuery<State[]>("catalog-states", () =>
    catalogApi.states().then((r) => r.data)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Cargando activo...
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
        <p>Activo no encontrado</p>
        <button onClick={() => navigate("/assets")} className="text-blue-400 text-sm hover:underline">
          Volver a activos
        </button>
      </div>
    );
  }

  return (
    <EditForm
      asset={asset}
      states={states}
      models={models}
      brands={brands}
      onSaved={() => {
        qc.invalidateQueries("assets");
        qc.invalidateQueries(["asset", id]);
        navigate("/assets");
      }}
      onBack={() => navigate("/assets")}
    />
  );
}

function EditForm({ asset, states, models, brands, onSaved, onBack }: {
  asset: Asset;
  states: State[];
  models: AssetModel[];
  brands: Brand[];
  onSaved: () => void;
  onBack: () => void;
}) {
  const isConsumable = asset.tipo === "consumible";
  const model = models.find((m) => m.id === asset.model_id);
  const brand = model ? brands.find((b) => b.id === model.brand_id) : null;

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

  // Ajuste de stock (solo consumibles)
  const [stockNuevo, setStockNuevo] = useState("");
  const [adjustObs, setAdjustObs] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState("");
  const stockDiff = stockNuevo !== "" && !isNaN(Number(stockNuevo))
    ? Number(stockNuevo) - asset.stock_actual
    : null;

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

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white">Editar activo</h2>
          <p className="text-xs text-gray-500 capitalize">{asset.tipo}</p>
        </div>
      </div>

      {/* Info del activo */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
          {isConsumable
            ? <Layers size={22} className="text-orange-400" />
            : <Package size={22} className="text-blue-400" />}
        </div>
        <div className="min-w-0">
          {asset.nombre && <p className="text-base font-semibold text-white truncate">{asset.nombre}</p>}
          <p className="font-mono text-sm text-gray-300">{asset.uid_fisico}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {[brand?.nombre, model?.nombre].filter(Boolean).join(" ") || "Sin modelo"}
          </p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-700">
          <Settings2 size={16} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Datos del activo</span>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{error}</p>
        )}

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
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
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
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
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
          <select
            value={form.estado_id}
            onChange={(e) => setForm({ ...form, estado_id: Number(e.target.value) })}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {states.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        {/* Consumible: stock mínimo */}
        {isConsumable && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">Cantidad mínima</label>
            <p className="text-xs text-gray-500">Alerta de stock bajo si cae por debajo de este número</p>
            <input
              type="number" min={0}
              value={form.stock_minimo}
              onChange={(e) => setForm({ ...form, stock_minimo: Number(e.target.value) })}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* Valor reposición */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-300">
            Valor de reposición <span className="text-gray-500 font-normal">(opcional)</span>
          </label>
          <p className="text-xs text-gray-500">Costo aproximado si se pierde o daña</p>
          <input
            type="number" min={0} placeholder="$0"
            value={form.valor_reposicion}
            onChange={(e) => setForm({ ...form, valor_reposicion: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Herramienta: próxima mantención */}
        {!isConsumable && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">
              Próxima mantención <span className="text-gray-500 font-normal">(opcional)</span>
            </label>
            <p className="text-xs text-gray-500">Fecha programada para revisión preventiva</p>
            <input
              type="date"
              value={form.proxima_mantencion}
              onChange={(e) => setForm({ ...form, proxima_mantencion: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors min-h-[48px]"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      {/* Ajustar stock — solo consumibles */}
      {isConsumable && (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-700">
            <Package2 size={16} className="text-green-400" />
            <span className="text-sm font-semibold text-white">Ajustar stock</span>
            <span className="ml-auto text-sm text-gray-400">
              Actual: <span className="text-white font-bold">{asset.stock_actual}</span>
            </span>
          </div>

          {adjustError && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{adjustError}</p>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">Nuevo stock total</label>
            <div className="flex items-center gap-3">
              <input
                type="number" min={0}
                placeholder={String(asset.stock_actual)}
                value={stockNuevo}
                onChange={(e) => setStockNuevo(e.target.value)}
                className="w-36 bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white text-center placeholder-gray-500 focus:outline-none focus:border-green-500"
              />
              {stockDiff !== null && stockDiff !== 0 && (
                <span className={`text-sm font-bold ${stockDiff > 0 ? "text-green-400" : "text-red-400"}`}>
                  {stockDiff > 0 ? `+${stockDiff}` : stockDiff} unidades
                </span>
              )}
              {stockDiff === 0 && stockNuevo !== "" && (
                <span className="text-xs text-gray-500">Sin cambio</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">
              Observación <span className="text-gray-500 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={adjustObs}
              onChange={(e) => setAdjustObs(e.target.value)}
              placeholder="Ej: Conteo físico bodega norte"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
          </div>

          <button
            type="button"
            onClick={handleAdjust}
            disabled={adjusting || stockNuevo === "" || isNaN(Number(stockNuevo))}
            className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors min-h-[48px]"
          >
            {adjusting ? "Ajustando..." : "Confirmar ajuste"}
          </button>
        </div>
      )}
    </div>
  );
}
