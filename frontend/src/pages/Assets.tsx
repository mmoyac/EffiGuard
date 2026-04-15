import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { Package, Layers, AlertTriangle, Plus, ChevronDown, ChevronUp, Camera, Settings2, X, RefreshCw, Printer, Wifi, Pencil, Trash2, Check, FileSpreadsheet } from "lucide-react";
import { LabelPreviewModal } from "../components/LabelPreviewModal";
import { ImportAssetsModal } from "../components/assets/ImportAssetsModal";

/** Genera un UID corto con prefijo, sin caracteres ambiguos (0/O, 1/I/L) */
function generateUid(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const code = Array.from(array).map((b) => chars[b % chars.length]).join("");
  return `${prefix}-${code}`;
}
import { assetsApi, catalogApi, api } from "../services/api";
import { CameraScanner } from "../components/scanner/CameraScanner";
import { NFCScanner } from "../components/scanner/NFCScanner";
import type { Asset, AssetFamily } from "../types";
import { familyColor, COLOR_OPTIONS } from "../utils/familyColors";

const ESTADO: Record<number, { label: string; color: string }> = {
  1: { label: "Disponible",    color: "text-green-400 bg-green-900/30 border-green-800" },
  2: { label: "En Terreno",    color: "text-blue-400 bg-blue-900/30 border-blue-800" },
  3: { label: "En Reparación", color: "text-yellow-400 bg-yellow-900/30 border-yellow-800" },
  4: { label: "Robado",        color: "text-red-400 bg-red-900/30 border-red-800" },
};

interface Brand { id: number; nombre: string; }
interface AssetModel { id: number; brand_id: number; nombre: string; }
interface State { id: number; nombre: string; }

const EMPTY_ASSET = {
  uid_fisico: "", nombre: "", model_id: 0, family_id: 0,
  estado_id: 1, stock_actual: 0, stock_minimo: 0,
  valor_reposicion: "", proxima_mantencion: "", parent_asset_id: 0,
};
const EMPTY_BRAND = { nombre: "" };
const EMPTY_MODEL = { brand_id: 0, nombre: "" };

export function Assets() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [labelPreview, setLabelPreview] = useState<{ title: string; subtitle?: string; uid: string } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [assetForm, setAssetForm] = useState(EMPTY_ASSET);
  const [assetError, setAssetError] = useState("");
  const [scanningUid, setScanningUid] = useState(false);
  const [nfcScanningUid, setNfcScanningUid] = useState(false);
  const [tipoSeleccionado, setTipoSeleccionado] = useState(false);
  const uidInputRef = useRef<HTMLInputElement>(null);

  const [showBrandForm, setShowBrandForm] = useState(false);
  const [brandForm, setBrandForm] = useState(EMPTY_BRAND);
  const [showModelForm, setShowModelForm] = useState(false);
  const [modelForm, setModelForm] = useState(EMPTY_MODEL);

  const { data: assets = [], isLoading } = useQuery<Asset[]>("assets", () =>
    assetsApi.list().then((r) => r.data)
  );
  const { data: families = [] } = useQuery<AssetFamily[]>("asset-families", () =>
    api.get("/asset-families").then((r) => r.data)
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

  const selectedFamily = families.find((f) => f.id === assetForm.family_id) ?? null;
  const isConsumableForm = selectedFamily?.comportamiento === "consumible";

  const createAsset = useMutation(
    (d: typeof EMPTY_ASSET) => api.post("/assets", {
      ...d,
      nombre: d.nombre || null,
      model_id: d.model_id ? Number(d.model_id) : null,
      family_id: Number(d.family_id),
      parent_asset_id: d.parent_asset_id ? Number(d.parent_asset_id) : null,
      estado_id: Number(d.estado_id),
      stock_actual: Number(d.stock_actual),
      stock_minimo: Number(d.stock_minimo),
      valor_reposicion: d.valor_reposicion ? Number(d.valor_reposicion) : null,
      proxima_mantencion: d.proxima_mantencion || null,
    }),
    {
      onSuccess: () => { qc.invalidateQueries("assets"); setShowAssetForm(false); setAssetForm(EMPTY_ASSET); setAssetError(""); },
      onError: (e: any) => setAssetError(e?.response?.data?.detail ?? "Error al crear activo"),
    }
  );

  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [familyForm, setFamilyForm] = useState({ nombre: "", comportamiento: "prestable", color: "blue", dias_max_prestamo: "" });
  const [editingFamily, setEditingFamily] = useState<{ id: number; nombre: string; color: string; dias_max_prestamo: string } | null>(null);
  const [familyError, setFamilyError] = useState("");

  const createBrand = useMutation(
    () => api.post("/catalog/brands", brandForm),
    { onSuccess: () => { qc.invalidateQueries("catalog-brands"); setShowBrandForm(false); setBrandForm(EMPTY_BRAND); } }
  );

  const createModel = useMutation(
    () => api.post("/catalog/models", { ...modelForm, brand_id: Number(modelForm.brand_id) }),
    { onSuccess: () => { qc.invalidateQueries("catalog-models"); setShowModelForm(false); setModelForm(EMPTY_MODEL); } }
  );

  const createFamily = useMutation(
    () => api.post("/asset-families", {
      ...familyForm,
      dias_max_prestamo: familyForm.dias_max_prestamo ? Number(familyForm.dias_max_prestamo) : null,
    }),
    {
      onSuccess: () => { qc.invalidateQueries("asset-families"); setShowFamilyForm(false); setFamilyForm({ nombre: "", comportamiento: "prestable", color: "blue", dias_max_prestamo: "" }); setFamilyError(""); },
      onError: (e: any) => setFamilyError(e?.response?.data?.detail ?? "Error al crear familia"),
    }
  );

  const updateFamily = useMutation(
    ({ id, nombre, color, dias_max_prestamo }: { id: number; nombre: string; color: string; dias_max_prestamo: string }) =>
      api.patch(`/asset-families/${id}`, {
        nombre,
        color,
        dias_max_prestamo: dias_max_prestamo ? Number(dias_max_prestamo) : null,
      }),
    {
      onSuccess: () => { qc.invalidateQueries("asset-families"); setEditingFamily(null); setFamilyError(""); },
      onError: (e: any) => setFamilyError(e?.response?.data?.detail ?? "Error al actualizar"),
    }
  );

  const deleteFamily = useMutation(
    (id: number) => api.delete(`/asset-families/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries("asset-families"); setFamilyError(""); },
      onError: (e: any) => setFamilyError(e?.response?.data?.detail ?? "No se puede eliminar"),
    }
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Package size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Activos</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
          {assets.length} total
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setShowCatalog((v) => !v); setShowAssetForm(false); }}
            title="Marcas y modelos"
            className={`p-2.5 rounded-xl border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              showCatalog
                ? "bg-gray-700 border-gray-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
            }`}
          >
            {showCatalog ? <X size={18} /> : <Settings2 size={18} />}
          </button>
          <button
            onClick={() => setShowImport(true)}
            title="Importar desde Excel"
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-sm font-medium px-3 py-2.5 rounded-xl min-h-[44px] transition-colors"
          >
            <FileSpreadsheet size={16} /> Importar
          </button>
          <button
            onClick={() => { setShowAssetForm((v) => !v); setShowCatalog(false); setAssetError(""); setTipoSeleccionado(false); setAssetForm(EMPTY_ASSET); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl min-h-[44px] transition-colors"
          >
            <Plus size={16} /> Nuevo activo
          </button>
        </div>
      </div>

      {/* Panel catálogo — marcas y modelos */}
      {showCatalog && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Catálogo</p>
          <CatalogoTab
            brands={brands} models={models}
            showBrandForm={showBrandForm} setShowBrandForm={setShowBrandForm}
            brandForm={brandForm} setBrandForm={setBrandForm}
            createBrand={createBrand}
            showModelForm={showModelForm} setShowModelForm={setShowModelForm}
            modelForm={modelForm} setModelForm={setModelForm}
            createModel={createModel}
            families={families}
            showFamilyForm={showFamilyForm} setShowFamilyForm={setShowFamilyForm}
            familyForm={familyForm} setFamilyForm={setFamilyForm}
            createFamily={createFamily}
            editingFamily={editingFamily} setEditingFamily={setEditingFamily}
            updateFamily={updateFamily}
            deleteFamily={deleteFamily}
            familyError={familyError} setFamilyError={setFamilyError}
          />
        </div>
      )}

      {/* Formulario nuevo activo */}
      {showAssetForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-4">
          <p className="text-sm font-semibold text-white">Nuevo activo</p>

          {/* Paso 1 — selección de familia */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-400">¿Qué tipo de activo es?</p>
            <div className="grid grid-cols-2 gap-3">
              {families.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => { setAssetForm((prev) => ({ ...prev, family_id: f.id })); setTipoSeleccionado(true); setTimeout(() => uidInputRef.current?.focus(), 50); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    assetForm.family_id === f.id && tipoSeleccionado
                      ? `${familyColor(f.color).border} ${familyColor(f.color).bg} ${familyColor(f.color).icon}`
                      : "border-gray-700 bg-gray-700/40 text-gray-400 hover:border-gray-500 hover:text-white"
                  }`}
                >
                  {f.comportamiento === "consumible" ? <Layers size={22} /> : <Package size={22} />}
                  <span className="font-semibold text-sm">{f.nombre}</span>
                  <span className="text-xs opacity-70 text-center leading-tight">
                    {f.comportamiento === "consumible" ? "Se descuenta del stock" : "Se presta y devuelve"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Paso 2 — campos según tipo */}
          {tipoSeleccionado && (
            <form onSubmit={(e) => { e.preventDefault(); createAsset.mutate(assetForm); }} className="space-y-3 pt-2 border-t border-gray-700">
              {assetError && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{assetError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Nombre */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-300">
                    Nombre <span className="text-gray-500 font-normal">(opcional)</span>
                  </label>
                  <p className="text-xs text-gray-500">
                    {isConsumableForm ? "Ej: Tornillo 1/2\", Cinta aislante, Pegamento PVC" : "Ej: Taladro percutor, Amoladora 9\""}
                  </p>
                  <input placeholder={isConsumableForm ? "Nombre del consumible" : `Nombre de ${selectedFamily?.nombre.toLowerCase() ?? "activo"}`}
                    value={assetForm.nombre}
                    onChange={(e) => setAssetForm({ ...assetForm, nombre: e.target.value })}
                    className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
                </div>

                {/* Código identificador */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-300">Código identificador <span className="text-red-400">*</span></label>
                  <p className="text-xs text-gray-500">
                    {isConsumableForm
                      ? "Escanea o escribe el código de barras del producto"
                      : "Puedes generar un código QR automático o escanear el tag RFID físico"}
                  </p>
                  <div className="flex gap-2">
                    <input ref={uidInputRef} required placeholder={isConsumableForm ? "Escanea el código de barras" : "Escanea o genera el código"} value={assetForm.uid_fisico}
                      onChange={(e) => setAssetForm({ ...assetForm, uid_fisico: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                      className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 flex-1 font-mono" />
                    <button type="button" title="Generar código automático"
                      onClick={() => setAssetForm((f) => ({ ...f, uid_fisico: generateUid(isConsumableForm ? "CONS" : "TOOL") }))}
                      className="px-3 rounded-xl border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors flex items-center min-h-[44px]">
                      <RefreshCw size={15} />
                    </button>
                    <button type="button" onClick={() => { setScanningUid((v) => !v); setNfcScanningUid(false); }} title="Escanear con cámara"
                      className={`px-3 rounded-xl border transition-colors flex items-center min-h-[44px] ${scanningUid ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"}`}>
                      <Camera size={16} />
                    </button>
                    <button type="button" onClick={() => { setNfcScanningUid((v) => !v); setScanningUid(false); }} title="Escanear tag NFC/RFID"
                      className={`px-3 rounded-xl border transition-colors flex items-center min-h-[44px] ${nfcScanningUid ? "bg-green-600 border-green-500 text-white" : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"}`}>
                      <Wifi size={16} />
                    </button>
                  </div>
                  {scanningUid && <CameraScanner active={scanningUid} onScan={(uid) => { setAssetForm((f) => ({ ...f, uid_fisico: uid })); setScanningUid(false); }} />}
                  {nfcScanningUid && <NFCScanner active={nfcScanningUid} onScan={(uid) => { setAssetForm((f) => ({ ...f, uid_fisico: uid })); setNfcScanningUid(false); }} />}
                </div>

                {/* Modelo */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-300">
                    Modelo {!isConsumableForm ? <span className="text-red-400">*</span> : <span className="text-gray-500 font-normal">(opcional)</span>}
                  </label>
                  <p className="text-xs text-gray-500">Si no aparece, créalo en ⚙ Catálogo</p>
                  <select required={!isConsumableForm} value={assetForm.model_id || ""}
                    onChange={(e) => setAssetForm({ ...assetForm, model_id: Number(e.target.value) })}
                    className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full">
                    <option value="">Seleccionar modelo</option>
                    {brands.map((b) => (
                      <optgroup key={b.id} label={b.nombre}>
                        {models.filter((m) => m.brand_id === b.id).map((m) => (
                          <option key={m.id} value={m.id}>{m.nombre}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Kit padre — solo activos prestables */}
                {!isConsumableForm && (
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-medium text-gray-300">
                      Pertenece a un kit <span className="text-gray-500 font-normal">(opcional)</span>
                    </label>
                    <p className="text-xs text-gray-500">Si este activo es parte de un kit, selecciona el kit padre</p>
                    <select value={assetForm.parent_asset_id || ""}
                      onChange={(e) => setAssetForm({ ...assetForm, parent_asset_id: Number(e.target.value) })}
                      className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 w-full">
                      <option value="">Sin kit (activo independiente)</option>
                      {assets
                        .filter((a) => a.family.comportamiento === "prestable" && a.parent_asset_id === null)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nombre ? `${a.nombre} — ${a.uid_fisico}` : a.uid_fisico}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Estado */}
                <div className={isConsumableForm ? "sm:col-span-2 space-y-1" : "space-y-1"}>
                  <label className="text-xs font-medium text-gray-300">Estado <span className="text-red-400">*</span></label>
                  <p className="text-xs text-gray-500">Condición actual al ingresarlo</p>
                  <select required value={assetForm.estado_id}
                    onChange={(e) => setAssetForm({ ...assetForm, estado_id: Number(e.target.value) })}
                    className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full">
                    {states.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>

                {/* Prestable: próxima mantención */}
                {!isConsumableForm && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-300">Próxima mantención <span className="text-gray-500 font-normal">(opcional)</span></label>
                    <p className="text-xs text-gray-500">Fecha de revisión preventiva</p>
                    <input type="date" value={assetForm.proxima_mantencion}
                      onChange={(e) => setAssetForm({ ...assetForm, proxima_mantencion: e.target.value })}
                      className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full" />
                  </div>
                )}

                {/* Consumible: stock */}
                {isConsumableForm && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Cantidad actual</label>
                      <p className="text-xs text-gray-500">Unidades en bodega hoy</p>
                      <input type="number" min="0" placeholder="0" value={assetForm.stock_actual}
                        onChange={(e) => setAssetForm({ ...assetForm, stock_actual: Number(e.target.value) })}
                        className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Cantidad mínima</label>
                      <p className="text-xs text-gray-500">Alerta si cae por debajo</p>
                      <input type="number" min="0" placeholder="0" value={assetForm.stock_minimo}
                        onChange={(e) => setAssetForm({ ...assetForm, stock_minimo: Number(e.target.value) })}
                        className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full" />
                    </div>
                  </>
                )}

                {/* Valor reposición */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-300">Valor reposición <span className="text-gray-500 font-normal">(opcional)</span></label>
                  <p className="text-xs text-gray-500">Costo si se pierde o daña</p>
                  <input type="number" min="0" placeholder="$0" value={assetForm.valor_reposicion}
                    onChange={(e) => setAssetForm({ ...assetForm, valor_reposicion: e.target.value })}
                    className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
                </div>

              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={createAsset.isLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]">
                  {createAsset.isLoading ? "Guardando..." : "Crear activo"}
                </button>
                <button type="button" onClick={() => { setShowAssetForm(false); setAssetError(""); setAssetForm(EMPTY_ASSET); setTipoSeleccionado(false); }}
                  className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

          {/* Lista */}
          {isLoading ? (
            <p className="text-gray-400">Cargando activos...</p>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-2xl py-16 gap-3 text-gray-500">
              <Package size={40} className="text-gray-700" />
              <p className="text-sm font-medium">No hay activos registrados</p>
              <button onClick={() => setShowAssetForm(true)}
                className="mt-2 flex items-center gap-2 text-blue-400 text-sm hover:text-blue-300 transition-colors">
                <Plus size={15} /> Crear el primero
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {assets.map((a) => <AssetCard key={a.id} asset={a} models={models} brands={brands} onEdit={(a) => navigate(`/assets/${a.id}/edit`)} onPrint={setLabelPreview} />)}
            </div>
          )}

      {labelPreview && (
        <LabelPreviewModal
          title={labelPreview.title}
          subtitle={labelPreview.subtitle}
          uid={labelPreview.uid}
          onClose={() => setLabelPreview(null)}
        />
      )}
      {showImport && <ImportAssetsModal onClose={() => setShowImport(false)} />}
    </div>
  );
}

function AssetCard({ asset, models, brands, onEdit, onPrint }: {
  asset: Asset; models: AssetModel[]; brands: Brand[]; onEdit: (a: Asset) => void;
  onPrint: (data: { title: string; subtitle?: string; uid: string }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const estado = ESTADO[asset.estado_id] ?? { label: "Desconocido", color: "text-gray-400 bg-gray-800 border-gray-700" };
  const isConsumable = asset.family.comportamiento === "consumible";
  const lowStock = isConsumable && asset.stock_actual <= asset.stock_minimo;
  const model = models.find((m) => m.id === asset.model_id);
  const brand = model ? brands.find((b) => b.id === model.brand_id) : null;

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 space-y-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
          {isConsumable
            ? <Layers size={18} className={familyColor(asset.family.color).icon} />
            : <Package size={18} className={familyColor(asset.family.color).icon} />}
        </div>
        <div className="min-w-0 flex-1">
          {asset.nombre && <p className="text-sm text-white font-semibold truncate">{asset.nombre}</p>}
          <p className="font-mono text-xs text-gray-400 truncate">{asset.uid_fisico}</p>
          <p className="text-xs text-gray-500 truncate">
            {[brand?.nombre, model?.nombre].filter(Boolean).join(" ") || "—"} · <span>{asset.family.nombre}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${estado.color}`}>
            {estado.label}
          </span>
          {!isConsumable && (
            <button
              onClick={() => onPrint({ title: asset.nombre ?? asset.uid_fisico, subtitle: [brand?.nombre, model?.nombre].filter(Boolean).join(" ") || undefined, uid: asset.uid_fisico })}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
              title="Imprimir etiqueta">
              <Printer size={14} />
            </button>
          )}
          <button onClick={() => onEdit(asset)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
            title="Editar">
            <Settings2 size={14} />
          </button>
        </div>
      </div>

      {isConsumable && (
        <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${lowStock ? "bg-yellow-900/20 border border-yellow-800" : "bg-gray-700/50"}`}>
          <div className="flex items-center gap-2">
            {lowStock && <AlertTriangle size={14} className="text-yellow-400" />}
            <span className="text-xs text-gray-400">Stock actual / mínimo</span>
          </div>
          <span className={`text-sm font-bold ${lowStock ? "text-yellow-400" : "text-green-400"}`}>
            {asset.stock_actual} / {asset.stock_minimo}
          </span>
        </div>
      )}

      {asset.children.length > 0 && (
        <>
          <button onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between text-xs text-purple-400 bg-purple-900/20 border border-purple-800 px-3 py-1.5 rounded-lg">
            <span>Kit — {asset.children.length} componente{asset.children.length !== 1 ? "s" : ""}</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expanded && (
            <div className="space-y-1 pl-2 border-l-2 border-purple-800/50">
              {asset.children.map((c) => (
                <p key={c.id} className="text-xs text-gray-400 font-mono">{c.uid_fisico}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CatalogoTab({ brands, models, showBrandForm, setShowBrandForm, brandForm, setBrandForm, createBrand,
  showModelForm, setShowModelForm, modelForm, setModelForm, createModel,
  families, showFamilyForm, setShowFamilyForm, familyForm, setFamilyForm, createFamily,
  editingFamily, setEditingFamily, updateFamily, deleteFamily, familyError, setFamilyError }: any) {
  return (
    <div className="space-y-6">

      {/* Familias */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-300">Familias ({families.length})</p>
          <button onClick={() => { setShowFamilyForm((v: boolean) => !v); setFamilyError(""); }}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <Plus size={14} /> Nueva familia
          </button>
        </div>

        {familyError && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{familyError}</p>
        )}

        {showFamilyForm && (
          <form onSubmit={(e) => { e.preventDefault(); createFamily.mutate(); }} className="space-y-3">
            <div className="flex gap-2">
              <input autoFocus required placeholder="Nombre de la familia" value={familyForm.nombre}
                onChange={(e) => setFamilyForm({ ...familyForm, nombre: e.target.value })}
                className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 flex-1" />
              <select required value={familyForm.comportamiento}
                onChange={(e) => setFamilyForm({ ...familyForm, comportamiento: e.target.value })}
                className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 flex-shrink-0">
                <option value="prestable">Prestable</option>
                <option value="consumible">Consumible</option>
              </select>
            </div>
            <ColorPicker value={familyForm.color} onChange={(c) => setFamilyForm({ ...familyForm, color: c })} />
            {familyForm.comportamiento === "prestable" && (
              <div className="flex items-center gap-2">
                <input type="number" min="1" placeholder="Días máx. préstamo (opcional)"
                  value={familyForm.dias_max_prestamo}
                  onChange={(e) => setFamilyForm({ ...familyForm, dias_max_prestamo: e.target.value })}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={createFamily.isLoading}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-colors">
                Crear
              </button>
              <button type="button" onClick={() => { setShowFamilyForm(false); setFamilyError(""); }}
                className="px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">
                ✕
              </button>
            </div>
          </form>
        )}

        {families.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">Sin familias registradas</p>
        ) : (
          <div className="space-y-1">
            {families.map((f: AssetFamily) => (
              <div key={f.id} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  {editingFamily?.id === f.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); updateFamily.mutate({ id: f.id, nombre: editingFamily.nombre, color: editingFamily.color, dias_max_prestamo: editingFamily.dias_max_prestamo }); }}
                      className="flex items-center gap-2 flex-1">
                      <input autoFocus required value={editingFamily.nombre}
                        onChange={(e) => setEditingFamily({ ...editingFamily, nombre: e.target.value })}
                        className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 flex-1" />
                      <button type="submit" disabled={updateFamily.isLoading}
                        className="p-1.5 rounded-lg text-green-400 hover:bg-gray-700 transition-colors">
                        <Check size={14} />
                      </button>
                      <button type="button" onClick={() => setEditingFamily(null)}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-700 transition-colors">
                        <X size={14} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${familyColor(f.color).swatch}`} />
                      <span className="text-sm text-white flex-1">{f.nombre}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${familyColor(f.color).badge}`}>
                        {f.comportamiento}
                      </span>
                      {f.dias_max_prestamo && (
                        <span className="text-xs text-gray-500 flex-shrink-0">{f.dias_max_prestamo}d</span>
                      )}
                      <button onClick={() => { setEditingFamily({ id: f.id, nombre: f.nombre, color: f.color, dias_max_prestamo: String(f.dias_max_prestamo ?? "") }); setFamilyError(""); }}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors flex-shrink-0">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => { setFamilyError(""); deleteFamily.mutate(f.id); }}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors flex-shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
                {editingFamily?.id === f.id && (
                  <>
                    <ColorPicker value={editingFamily.color} onChange={(c) => setEditingFamily({ ...editingFamily, color: c })} />
                    {f.comportamiento === "prestable" && (
                      <input type="number" min="1" placeholder="Días máx. préstamo (opcional)"
                        value={editingFamily.dias_max_prestamo}
                        onChange={(e) => setEditingFamily({ ...editingFamily, dias_max_prestamo: e.target.value })}
                        className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-700" />

      {/* Marcas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-300">Marcas ({brands.length})</p>
          <button onClick={() => setShowBrandForm((v: boolean) => !v)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <Plus size={14} /> Nueva marca
          </button>
        </div>

        {showBrandForm && (
          <form onSubmit={(e) => { e.preventDefault(); createBrand.mutate(); }}
            className="flex gap-2">
            <input autoFocus required placeholder="Nombre de la marca" value={brandForm.nombre}
              onChange={(e) => setBrandForm({ nombre: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full flex-1" />
            <button type="submit" disabled={createBrand.isLoading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-colors">
              Crear
            </button>
            <button type="button" onClick={() => setShowBrandForm(false)}
              className="px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">
              ✕
            </button>
          </form>
        )}

        {brands.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">Sin marcas registradas</p>
        ) : (
          <div className="space-y-1">
            {brands.map((b: Brand) => (
              <div key={b.id} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <span className="text-sm text-white flex-1">{b.nombre}</span>
                <span className="text-xs text-gray-500">
                  {models.filter((m: AssetModel) => m.brand_id === b.id).length} modelo{models.filter((m: AssetModel) => m.brand_id === b.id).length !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modelos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-300">Modelos ({models.length})</p>
          <button onClick={() => setShowModelForm((v: boolean) => !v)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <Plus size={14} /> Nuevo modelo
          </button>
        </div>

        {showModelForm && (
          <form onSubmit={(e) => { e.preventDefault(); createModel.mutate(); }}
            className="flex gap-2 flex-wrap">
            <select required value={modelForm.brand_id || ""}
              onChange={(e) => setModelForm({ ...modelForm, brand_id: Number(e.target.value) })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full w-full sm:w-auto sm:flex-shrink-0">
              <option value="">Marca</option>
              {brands.map((b: Brand) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
            <input required placeholder="Nombre del modelo" value={modelForm.nombre}
              onChange={(e) => setModelForm({ ...modelForm, nombre: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full flex-1 min-w-0" />
            <button type="submit" disabled={createModel.isLoading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-colors">
              Crear
            </button>
            <button type="button" onClick={() => setShowModelForm(false)}
              className="px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">
              ✕
            </button>
          </form>
        )}

        {models.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">Sin modelos registrados</p>
        ) : (
          <div className="space-y-1">
            {brands.map((b: Brand) => {
              const bModels = models.filter((m: AssetModel) => m.brand_id === b.id);
              if (!bModels.length) return null;
              return (
                <div key={b.id}>
                  <p className="text-xs text-gray-500 px-1 mb-1">{b.nombre}</p>
                  {bModels.map((m: AssetModel) => (
                    <div key={m.id} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 flex items-center gap-2 mb-1">
                      <span className="text-sm text-white">{m.nombre}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {COLOR_OPTIONS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full transition-all ${familyColor(c).swatch} ${
            value === c ? "ring-2 ring-white ring-offset-2 ring-offset-gray-800 scale-110" : "opacity-60 hover:opacity-100"
          }`}
        />
      ))}
    </div>
  );
}
