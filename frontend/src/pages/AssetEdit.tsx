import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "react-query";
import { ArrowLeft, Package, Layers, Settings2, Package2, Camera, RefreshCw } from "lucide-react";
import { assetsApi, catalogApi, api } from "../services/api";
import { familyColor } from "../utils/familyColors";
import type { AssetFamily, UnidadMedida } from "../types";
import { CameraScanner } from "../components/scanner/CameraScanner";
import { UbicacionPicker } from "../components/assets/UbicacionPicker";
import type { Asset } from "../types";
import { Link2 } from "lucide-react";

function generateUid(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return `${prefix}-${Array.from(array).map((b) => chars[b % chars.length]).join("")}`;
}

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
  const { data: allAssets = [] } = useQuery<Asset[]>("assets", () =>
    assetsApi.list().then((r) => r.data)
  );
  const { data: families = [] } = useQuery<AssetFamily[]>("asset-families", () =>
    api.get("/asset-families").then((r) => r.data)
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
      families={families}
      allAssets={allAssets}
      onSaved={() => {
        qc.invalidateQueries("assets");
        qc.invalidateQueries(["asset", id]);
        navigate("/assets");
      }}
      onBack={() => navigate("/assets")}
    />
  );
}

function EditForm({ asset, states, models, brands, families, allAssets, onSaved, onBack }: {
  asset: Asset;
  states: State[];
  models: AssetModel[];
  brands: Brand[];
  families: AssetFamily[];
  allAssets: Asset[];
  onSaved: () => void;
  onBack: () => void;
}) {
  const model = models.find((m) => m.id === asset.model_id);
  const brand = model ? brands.find((b) => b.id === model.brand_id) : null;

  const [form, setForm] = useState({
    uid_fisico: asset.uid_fisico,
    nombre: asset.nombre ?? "",
    family_id: asset.family_id,
    model_id: asset.model_id ? String(asset.model_id) : "",
    estado_id: asset.estado_id,
    parent_asset_id: asset.parent_asset_id ? String(asset.parent_asset_id) : "",
    stock_minimo: asset.stock_minimo,
    valor_reposicion: asset.valor_reposicion ? String(asset.valor_reposicion) : "",
    proxima_mantencion: asset.proxima_mantencion ?? "",
    dias_max_prestamo: asset.dias_max_prestamo ? String(asset.dias_max_prestamo) : "",
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
  const selectedFamily = families.find((f) => f.id === form.family_id) ?? asset.family;
  const isConsumableForm = selectedFamily.comportamiento === "consumible";
  const kitOptions = allAssets.filter(
    (a) => a.family.comportamiento === "prestable" && a.parent_asset_id === null && a.id !== asset.id
  );
  const [scanningUid, setScanningUid] = useState(false);
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
        uid_fisico: form.uid_fisico.trim() || undefined,
        nombre: form.nombre.trim() || null,
        family_id: form.family_id,
        model_id: form.model_id ? Number(form.model_id) : null,
        ...(!isConsumableForm && { parent_asset_id: form.parent_asset_id ? Number(form.parent_asset_id) : null }),
        estado_id: Number(form.estado_id),
        stock_minimo: Number(form.stock_minimo),
        valor_reposicion: form.valor_reposicion ? Number(form.valor_reposicion) : null,
        proxima_mantencion: form.proxima_mantencion || null,
        dias_max_prestamo: form.dias_max_prestamo ? Number(form.dias_max_prestamo) : null,
        ubicacion_id: ubicacionId,
        codigo_fabricante: form.codigo_fabricante.trim() || null,
        // El empaque sólo aplica a consumibles: en una herramienta no significa nada
        ...(isConsumableForm
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
          <p className="text-xs text-gray-500">{asset.family.nombre}</p>
        </div>
      </div>

      {/* Info del activo */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
          {isConsumableForm
            ? <Layers size={22} className={familyColor(selectedFamily.color).icon} />
            : <Package size={22} className={familyColor(selectedFamily.color).icon} />}
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

        {/* Familia */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-300">Familia</label>
          <div className="flex flex-wrap gap-2">
            {families.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, family_id: f.id }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  form.family_id === f.id
                    ? `${familyColor(f.color).badge} border-current`
                    : "bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${familyColor(f.color).swatch}`} />
                {f.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Código identificador */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-300">Código identificador <span className="text-red-400">*</span></label>
          <p className="text-xs text-gray-500">
            {isConsumableForm ? "Código de barras del producto" : "QR o tag RFID — puedes generar uno nuevo o escanear el físico"}
          </p>
          <div className="flex gap-2">
            <input
              required
              value={form.uid_fisico}
              onChange={(e) => setForm({ ...form, uid_fisico: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
            />
            {!isConsumableForm && (
              <button type="button" title="Generar nuevo código"
                onClick={() => setForm((f) => ({ ...f, uid_fisico: generateUid("TOOL") }))}
                className="px-3 rounded-xl border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors flex items-center min-h-[44px]">
                <RefreshCw size={15} />
              </button>
            )}
            <button type="button" title="Escanear con cámara"
              onClick={() => setScanningUid((v) => !v)}
              className={`px-3 rounded-xl border transition-colors flex items-center min-h-[44px] ${scanningUid ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"}`}>
              <Camera size={15} />
            </button>
          </div>
          {scanningUid && (
            <CameraScanner active={scanningUid} onScan={(uid) => { setForm((f) => ({ ...f, uid_fisico: uid })); setScanningUid(false); }} />
          )}
        </div>

        {/* Nombre */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-300">
            Nombre <span className="text-gray-500 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder={isConsumableForm ? "Ej: Clavos 3 pulgadas" : `Ej: ${asset.family.nombre} grande bodega norte`}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Modelo */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-300">
            Modelo {isConsumableForm && <span className="text-gray-500 font-normal">(opcional)</span>}
          </label>
          <select
            value={form.model_id}
            onChange={(e) => setForm({ ...form, model_id: e.target.value })}
            required={!isConsumableForm}
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
          <input
            placeholder="7891234567890"
            value={form.codigo_fabricante}
            onChange={(e) => setForm({ ...form, codigo_fabricante: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Consumible: unidad, stock mínimo y empaque de compra */}
        {isConsumableForm && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300">Unidad de medida</label>
              <p className="text-xs text-gray-500">En qué se despacha: la unidad en que vive el stock</p>
              <select
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value as UnidadMedida })}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="unidad">Unidad (tornillos, guantes)</option>
                <option value="metro">Metro (cable, luces LED)</option>
                <option value="kilo">Kilo</option>
                <option value="litro">Litro</option>
              </select>
            </div>

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

            {/* Empaque de compra: se compra en cajas, se despacha en unidades */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300">
                Empaque de compra <span className="text-gray-500 font-normal">(opcional)</span>
              </label>
              <p className="text-xs text-gray-500">
                Si compras por caja o rollo, la compra se ingresa en empaques y el stock sube en unidades.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number" min={0} step="any" placeholder="Contenido (100)"
                  value={form.contenido_por_empaque}
                  onChange={(e) => setForm({ ...form, contenido_por_empaque: e.target.value })}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full"
                />
                <input
                  placeholder="Nombre (caja)"
                  value={form.nombre_empaque}
                  onChange={(e) => setForm({ ...form, nombre_empaque: e.target.value })}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full"
                />
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
                    className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
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
                    className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full disabled:opacity-40" />
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

        {/* Prestable: kit padre */}
        {!isConsumableForm && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
              <Link2 size={13} className="text-purple-400" />
              Pertenece a un kit <span className="text-gray-500 font-normal">(opcional)</span>
            </label>
            <p className="text-xs text-gray-500">Si este activo es parte de un kit, selecciona el kit padre</p>
            <select
              value={form.parent_asset_id}
              onChange={(e) => setForm({ ...form, parent_asset_id: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">Sin kit (activo independiente)</option>
              {kitOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre ? `${a.nombre} — ${a.uid_fisico}` : a.uid_fisico}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Herramienta: próxima mantención */}
        {!isConsumableForm && (
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

        {/* Prestable: días máx. préstamo */}
        {!isConsumableForm && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300">
              Días máx. préstamo <span className="text-gray-500 font-normal">(opcional)</span>
            </label>
            <p className="text-xs text-gray-500">
              {selectedFamily.dias_max_prestamo
                ? `Heredado de familia: ${selectedFamily.dias_max_prestamo} días — deja vacío para usar ese valor`
                : "Sin límite por defecto en la familia — define uno específico para este activo"}
            </p>
            <input
              type="number" min={1}
              placeholder={selectedFamily.dias_max_prestamo ? String(selectedFamily.dias_max_prestamo) : "Sin límite"}
              value={form.dias_max_prestamo}
              onChange={(e) => setForm({ ...form, dias_max_prestamo: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
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
      {isConsumableForm && (
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
