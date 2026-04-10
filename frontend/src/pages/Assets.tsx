import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { Package, Layers, AlertTriangle, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { assetsApi, catalogApi, api } from "../services/api";
import type { Asset } from "../types";

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
  uid_fisico: "", model_id: 0, tipo: "herramienta",
  estado_id: 1, stock_actual: 0, stock_minimo: 0,
  valor_reposicion: "", proxima_mantencion: "",
};
const EMPTY_BRAND = { nombre: "" };
const EMPTY_MODEL = { brand_id: 0, nombre: "" };

type Tab = "assets" | "catalogo";

export function Assets() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("assets");
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [assetForm, setAssetForm] = useState(EMPTY_ASSET);
  const [assetError, setAssetError] = useState("");

  const [showBrandForm, setShowBrandForm] = useState(false);
  const [brandForm, setBrandForm] = useState(EMPTY_BRAND);
  const [showModelForm, setShowModelForm] = useState(false);
  const [modelForm, setModelForm] = useState(EMPTY_MODEL);

  const { data: assets = [], isLoading } = useQuery<Asset[]>("assets", () =>
    assetsApi.list().then((r) => r.data)
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

  const createAsset = useMutation(
    (d: typeof EMPTY_ASSET) => api.post("/assets/", {
      ...d,
      model_id: Number(d.model_id),
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

  const createBrand = useMutation(
    () => api.post("/catalog/brands", brandForm),
    { onSuccess: () => { qc.invalidateQueries("catalog-brands"); setShowBrandForm(false); setBrandForm(EMPTY_BRAND); } }
  );

  const createModel = useMutation(
    () => api.post("/catalog/models", { ...modelForm, brand_id: Number(modelForm.brand_id) }),
    { onSuccess: () => { qc.invalidateQueries("catalog-models"); setShowModelForm(false); setModelForm(EMPTY_MODEL); } }
  );

  // Filtrar modelos por marca seleccionada
  const filteredModels = assetForm.model_id === 0
    ? models
    : models.filter((m) => m.brand_id === Number(
        models.find((x) => x.id === Number(assetForm.model_id))?.brand_id ?? 0
      ));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Package size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Activos</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
          {assets.length} total
        </span>
        <button
          onClick={() => { setShowAssetForm((v) => !v); setAssetError(""); }}
          className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl min-h-[44px] transition-colors"
        >
          <Plus size={16} /> Nuevo activo
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
        {([["assets", "Activos"], ["catalogo", "Marcas y Modelos"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-colors ${
              tab === key ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "assets" ? (
        <>
          {/* Formulario nuevo activo */}
          {showAssetForm && (
            <form onSubmit={(e) => { e.preventDefault(); createAsset.mutate(assetForm); }}
              className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Nuevo activo</p>
              {assetError && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{assetError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input required placeholder="UID físico (QR / RFID)" value={assetForm.uid_fisico}
                  onChange={(e) => setAssetForm({ ...assetForm, uid_fisico: e.target.value })}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full sm:col-span-2" />

                <select required value={assetForm.model_id || ""}
                  onChange={(e) => setAssetForm({ ...assetForm, model_id: Number(e.target.value) })}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full">
                  <option value="">Seleccionar modelo</option>
                  {brands.map((b) => (
                    <optgroup key={b.id} label={b.nombre}>
                      {models.filter((m) => m.brand_id === b.id).map((m) => (
                        <option key={m.id} value={m.id}>{m.nombre}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <select value={assetForm.tipo} onChange={(e) => setAssetForm({ ...assetForm, tipo: e.target.value })}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full">
                  <option value="herramienta">Herramienta</option>
                  <option value="consumible">Consumible</option>
                </select>

                <select required value={assetForm.estado_id}
                  onChange={(e) => setAssetForm({ ...assetForm, estado_id: Number(e.target.value) })}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full">
                  {states.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>

                {assetForm.tipo === "consumible" && (
                  <>
                    <input type="number" min="0" placeholder="Stock actual" value={assetForm.stock_actual}
                      onChange={(e) => setAssetForm({ ...assetForm, stock_actual: Number(e.target.value) })}
                      className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
                    <input type="number" min="0" placeholder="Stock mínimo" value={assetForm.stock_minimo}
                      onChange={(e) => setAssetForm({ ...assetForm, stock_minimo: Number(e.target.value) })}
                      className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
                  </>
                )}

                <input type="number" min="0" placeholder="Valor reposición (opcional)" value={assetForm.valor_reposicion}
                  onChange={(e) => setAssetForm({ ...assetForm, valor_reposicion: e.target.value })}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />

                <input type="date" placeholder="Próxima mantención" value={assetForm.proxima_mantencion}
                  onChange={(e) => setAssetForm({ ...assetForm, proxima_mantencion: e.target.value })}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={createAsset.isLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]">
                  {createAsset.isLoading ? "Guardando..." : "Crear activo"}
                </button>
                <button type="button" onClick={() => { setShowAssetForm(false); setAssetError(""); setAssetForm(EMPTY_ASSET); }}
                  className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">
                  Cancelar
                </button>
              </div>
            </form>
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
              {assets.map((a) => <AssetCard key={a.id} asset={a} states={states} models={models} brands={brands} />)}
            </div>
          )}
        </>
      ) : (
        /* Tab catálogo */
        <CatalogoTab
          brands={brands} models={models}
          showBrandForm={showBrandForm} setShowBrandForm={setShowBrandForm}
          brandForm={brandForm} setBrandForm={setBrandForm}
          createBrand={createBrand}
          showModelForm={showModelForm} setShowModelForm={setShowModelForm}
          modelForm={modelForm} setModelForm={setModelForm}
          createModel={createModel}
        />
      )}
    </div>
  );
}

function AssetCard({ asset, states, models, brands }: {
  asset: Asset; states: State[]; models: AssetModel[]; brands: Brand[];
}) {
  const [expanded, setExpanded] = useState(false);
  const estado = ESTADO[asset.estado_id] ?? { label: "Desconocido", color: "text-gray-400 bg-gray-800 border-gray-700" };
  const isConsumable = asset.tipo === "consumible";
  const lowStock = isConsumable && asset.stock_actual <= asset.stock_minimo;
  const model = models.find((m) => m.id === asset.model_id);
  const brand = model ? brands.find((b) => b.id === model.brand_id) : null;

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 space-y-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
          {isConsumable ? <Layers size={18} className="text-orange-400" /> : <Package size={18} className="text-blue-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm text-white font-semibold truncate">{asset.uid_fisico}</p>
          <p className="text-xs text-gray-500 capitalize truncate">
            {brand?.nombre} {model?.nombre ?? asset.tipo}
          </p>
        </div>
        <span className={`flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-full border ${estado.color}`}>
          {estado.label}
        </span>
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
  showModelForm, setShowModelForm, modelForm, setModelForm, createModel }: any) {
  return (
    <div className="space-y-4">
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
