import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Download,
  HardHat,
  Layers,
  Package,
  Pencil,
  Plus,
  ShoppingCart,
  Star,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { catalogoApi } from "../services/api";
import { TenantGuard } from "../components/layout/TenantGuard";
import { ModalCompra } from "../components/catalogo/ModalCompra";
import { ModalEntrega } from "../components/catalogo/ModalEntrega";
import { ModalProducto } from "../components/catalogo/ModalProducto";
import { ModalEditarVariante } from "../components/catalogo/ModalEditarVariante";
import { AltaUnidades, ListaUnidades } from "../components/catalogo/ListaUnidades";
import { ModalAjuste } from "../components/catalogo/ModalAjuste";
import {
  BTN,
  COLORES_FAMILIA as COLORES,
  Campo,
  INPUT,
  Modal,
  TIPO_ESTILO,
  mensajeError,
  type Codigo,
  type Producto,
  type Unidad,
  type Variante,
} from "../components/catalogo/shared";

type Reporte = {
  dry_run: boolean;
  productos_creados: number;
  variantes_creadas: number;
  variantes_actualizadas: number;
  unidades_creadas: number;
  codigos_creados: number;
  proveedores_creados: number;
  ubicaciones_creadas: number;
  ajustes_stock: { fila: number; variante: string; de: number; a: number; tipo: string }[];
  advertencias: { fila: number; motivo: string }[];
  errores: { fila: number; motivo: string }[];
};

function ChipCodigo({ c, editable = false }: { c: Codigo; editable?: boolean }) {
  const qc = useQueryClient();
  const refrescar = () => qc.invalidateQueries("productos");

  const principal = useMutation(() => catalogoApi.setCodigoPrincipal(c.id), {
    onSuccess: refrescar,
  });
  const borrar = useMutation(() => catalogoApi.deleteCodigo(c.id), {
    onSuccess: refrescar,
    // El backend impide dejar una unidad sin códigos y explica por qué
    onError: (e: any) => alert(mensajeError(e, "No se pudo eliminar el código")),
  });

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-mono ${
        TIPO_ESTILO[c.tipo] ?? "bg-gray-700 text-gray-300"
      }`}
      title={`${c.tipo}${c.proveedor_nombre ? ` · ${c.proveedor_nombre}` : ""}`}
    >
      {c.es_principal && <span className="text-[10px]" title="Principal">★</span>}
      {c.codigo}
      {/* El factor sólo significa algo en un empaque: es cuántas unidades trae */}
      {c.tipo === "empaque" && (
        <span className="opacity-70">
          ×{c.factor} {c.nombre_empaque ?? ""}
        </span>
      )}
      {c.proveedor_nombre && <span className="opacity-70 not-italic">· {c.proveedor_nombre}</span>}
      {editable && (
        <>
          {!c.es_principal && (
            <button
              onClick={() => principal.mutate()}
              title="Marcar como principal"
              className="opacity-50 hover:opacity-100 ml-0.5"
            >
              <Star size={12} />
            </button>
          )}
          <button
            onClick={() => borrar.mutate()}
            title="Eliminar código"
            className="opacity-50 hover:opacity-100 hover:text-red-300"
          >
            <Trash2 size={12} />
          </button>
        </>
      )}
    </span>
  );
}

/**
 * Alta de variante dentro de un producto existente.
 *
 * Sólo tiene sentido cuando la diferencia la nota quien lo usa: un M4x20 no entra
 * donde entra un M3.5x15. Si lo único que cambia es el proveedor o el tamaño de
 * la caja, eso es un código más sobre la variante que ya existe.
 */
function ModalVariante({ producto, onClose }: { producto: Producto; onClose: () => void }) {
  const qc = useQueryClient();
  const esPrestable = producto.comportamiento === "prestable";
  const [f, setF] = useState({
    nombre: "",
    unidad: "unidad",
    stock_minimo: "0",
    precio_compra: "",
    valor_reposicion: "",
    dias_max_prestamo: "",
    cantidad_unidades: "0",
  });
  const [error, setError] = useState("");

  const crear = useMutation(
    () =>
      catalogoApi.createVariante(producto.id, {
        nombre: f.nombre.trim(),
        unidad: f.unidad,
        stock_minimo: Number(f.stock_minimo.replace(",", ".")) || 0,
        ...(f.precio_compra ? { precio_compra: Number(f.precio_compra.replace(",", ".")) } : {}),
        ...(f.valor_reposicion
          ? { valor_reposicion: Number(f.valor_reposicion.replace(",", ".")) }
          : {}),
        ...(esPrestable && f.dias_max_prestamo
          ? { dias_max_prestamo: Number(f.dias_max_prestamo) }
          : {}),
        ...(esPrestable ? { cantidad_unidades: Number(f.cantidad_unidades) || 0 } : {}),
      }),
    {
      onSuccess: () => {
        qc.invalidateQueries("productos");
        onClose();
      },
      onError: (e) => setError(mensajeError(e, "No se pudo crear la variante")),
    }
  );

  return (
    <Modal titulo="Nueva variante" subtitulo={producto.nombre} onClose={onClose}>
      <Campo label="Nombre de la variante">
        <input
          className={INPUT}
          placeholder="6x40 zincado"
          value={f.nombre}
          onChange={(e) => setF({ ...f, nombre: e.target.value })}
        />
      </Campo>

      {!esPrestable && (
        <Campo label="Unidad de despacho">
          <select
            className={INPUT}
            value={f.unidad}
            onChange={(e) => setF({ ...f, unidad: e.target.value })}
          >
            {["unidad", "metro", "kilo", "litro"].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Campo>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Campo label="Stock mínimo">
          <input
            className={INPUT}
            inputMode="decimal"
            value={f.stock_minimo}
            onChange={(e) => setF({ ...f, stock_minimo: e.target.value })}
          />
        </Campo>
        {esPrestable ? (
          <Campo label="Valor de reposición">
            <input
              className={INPUT}
              inputMode="decimal"
              value={f.valor_reposicion}
              onChange={(e) => setF({ ...f, valor_reposicion: e.target.value })}
            />
          </Campo>
        ) : (
          <Campo label="Precio de compra">
            <input
              className={INPUT}
              inputMode="decimal"
              value={f.precio_compra}
              onChange={(e) => setF({ ...f, precio_compra: e.target.value })}
            />
          </Campo>
        )}
      </div>

      {esPrestable && (
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Días máx. préstamo">
            <input
              className={INPUT}
              inputMode="numeric"
              placeholder="hereda familia"
              value={f.dias_max_prestamo}
              onChange={(e) => setF({ ...f, dias_max_prestamo: e.target.value })}
            />
          </Campo>
          <Campo label="Ejemplares a crear">
            <input
              className={INPUT}
              inputMode="numeric"
              value={f.cantidad_unidades}
              onChange={(e) => setF({ ...f, cantidad_unidades: e.target.value })}
            />
          </Campo>
        </div>
      )}

      {/* El stock inicial no se pide acá: entra por compra o ajuste, para que
          todo movimiento quede en la bitácora en vez de aparecer de la nada. */}
      <p className="text-xs text-gray-500">
        El stock inicial se carga con una compra o un ajuste, no acá: así queda en la
        bitácora.
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onClose} className={`${BTN} flex-1 bg-gray-700 text-white`}>
          Cancelar
        </button>
        <button
          onClick={() => crear.mutate()}
          disabled={crear.isLoading || !f.nombre.trim()}
          className={`${BTN} flex-1 bg-blue-600 text-white hover:bg-blue-500`}
        >
          {crear.isLoading ? "Creando…" : "Crear variante"}
        </button>
      </div>
    </Modal>
  );
}

// Sólo los que identifican QUÉ es algo: `serie_fabrica` identifica un ejemplar
// concreto y el backend lo rechaza sobre una variante.
const TIPOS_DE_VARIANTE = [
  ["proveedor", "Código del proveedor", "El número con que este proveedor lo vende"],
  ["empaque", "Código del empaque", "La caja, rollo o saco — indica cuántas trae"],
  ["fabricante", "EAN de fábrica", "El que viene impreso, igual para todos los proveedores"],
  ["propio", "Código interno", "El que asignas tú"],
] as const;

function ModalCodigo({ v, onClose }: { v: Variante; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    codigo: "",
    tipo: "proveedor",
    factor: "1",
    nombre_empaque: "caja",
    proveedor_id: "",
  });
  const [nuevoProveedor, setNuevoProveedor] = useState("");
  const [error, setError] = useState("");
  const esEmpaque = f.tipo === "empaque";

  const { data: proveedores = [] } = useQuery<{ id: number; nombre: string }[]>(
    "proveedores",
    () => catalogoApi.listProveedores().then((r) => r.data)
  );

  const crear = useMutation(
    async () => {
      let proveedorId = f.proveedor_id ? Number(f.proveedor_id) : null;
      // Crear el proveedor al vuelo evita mandar al bodeguero a otra pantalla
      // en medio de la carga de un código.
      if (!proveedorId && nuevoProveedor.trim()) {
        const r = await catalogoApi.createProveedor({ nombre: nuevoProveedor.trim() });
        proveedorId = r.data.id;
        qc.invalidateQueries("proveedores");
      }
      return catalogoApi.addCodigoVariante(v.id, {
        codigo: f.codigo.trim(),
        tipo: f.tipo,
        factor: esEmpaque ? Number(f.factor.replace(",", ".")) || 1 : 1,
        ...(esEmpaque && f.nombre_empaque ? { nombre_empaque: f.nombre_empaque.trim() } : {}),
        ...(proveedorId ? { proveedor_id: proveedorId } : {}),
      });
    },
    {
      onSuccess: () => {
        qc.invalidateQueries("productos");
        onClose();
      },
      onError: (e) => setError(mensajeError(e, "No se pudo agregar el código")),
    }
  );

  return (
    <Modal
      titulo="Agregar código"
      subtitulo={`${v.producto_nombre} · ${v.nombre}`}
      onClose={onClose}
    >
      <Campo label="Código">
        <input
          className={`${INPUT} font-mono`}
          placeholder="Escanéalo o escríbelo"
          autoFocus
          value={f.codigo}
          onChange={(e) => setF({ ...f, codigo: e.target.value })}
        />
      </Campo>

      <Campo label="Qué es este código">
        <select
          className={INPUT}
          value={f.tipo}
          onChange={(e) => setF({ ...f, tipo: e.target.value })}
        >
          {TIPOS_DE_VARIANTE.map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {TIPOS_DE_VARIANTE.find(([t]) => t === f.tipo)?.[2]}
        </p>
      </Campo>

      {esEmpaque && (
        <div className="grid grid-cols-2 gap-2">
          <Campo label={`Cuántas ${v.unidad} trae`}>
            <input
              className={INPUT}
              inputMode="decimal"
              value={f.factor}
              onChange={(e) => setF({ ...f, factor: e.target.value })}
            />
          </Campo>
          <Campo label="Cómo se llama el envase">
            <input
              className={INPUT}
              placeholder="caja, rollo, saco…"
              value={f.nombre_empaque}
              onChange={(e) => setF({ ...f, nombre_empaque: e.target.value })}
            />
          </Campo>
        </div>
      )}

      <Campo label="Proveedor (opcional)">
        <select
          className={INPUT}
          value={f.proveedor_id}
          onChange={(e) => setF({ ...f, proveedor_id: e.target.value })}
        >
          <option value="">— sin proveedor —</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        {!f.proveedor_id && (
          <input
            className={`${INPUT} mt-2`}
            placeholder="…o escribe uno nuevo para crearlo"
            value={nuevoProveedor}
            onChange={(e) => setNuevoProveedor(e.target.value)}
          />
        )}
      </Campo>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onClose} className={`${BTN} flex-1 bg-gray-700 text-white`}>
          Cancelar
        </button>
        <button
          onClick={() => crear.mutate()}
          disabled={crear.isLoading || !f.codigo.trim()}
          className={`${BTN} flex-1 bg-blue-600 text-white hover:bg-blue-500`}
        >
          {crear.isLoading ? "Agregando…" : "Agregar código"}
        </button>
      </div>
    </Modal>
  );
}
function FilaVariante({ v }: { v: Variante }) {
  const [abierta, setAbierta] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const [agregandoCodigo, setAgregandoCodigo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const esPrestable = v.comportamiento === "prestable";
  const qc = useQueryClient();

  const borrarVariante = useMutation(() => catalogoApi.deleteVariante(v.id), {
    onSuccess: () => qc.invalidateQueries("productos"),
    // El backend explica el bloqueo: stock, unidades o movimientos en la bitácora
    onError: (e: any) => alert(mensajeError(e, "No se pudo eliminar la variante")),
  });

  const { data: unidades = [] } = useQuery<Unidad[]>(
    ["unidades", v.id],
    () => catalogoApi.listUnidades(v.id).then((r) => r.data),
    { enabled: abierta && esPrestable }
  );

  return (
    <div className="border-t border-gray-700/60">
      <button
        onClick={() => setAbierta((a) => !a)}
        className="w-full text-left px-3 py-3 min-h-[48px] hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">{v.nombre}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
              {esPrestable ? (
                <span>
                  <span className="text-white font-medium">{v.unidades_disponibles}</span> de{" "}
                  {v.unidades_total} disponibles
                </span>
              ) : (
                <span>
                  <span className="text-white font-medium">{v.stock_efectivo}</span> {v.unidad}
                  {v.stock_minimo > 0 && <span className="opacity-70"> · mín {v.stock_minimo}</span>}
                </span>
              )}
              {v.ubicacion && (
                <span className="font-mono opacity-80">
                  {v.ubicacion.rack}/{v.ubicacion.nivel}/{v.ubicacion.posicion}
                </span>
              )}
              {v.bajo_stock && (
                <span className="inline-flex items-center gap-1 text-yellow-400">
                  <AlertTriangle size={12} /> bajo mínimo
                </span>
              )}
            </div>
          </div>
          {abierta ? (
            <ChevronUp size={18} className="text-gray-500 mt-1 flex-shrink-0" />
          ) : (
            <ChevronDown size={18} className="text-gray-500 mt-1 flex-shrink-0" />
          )}
        </div>
      </button>

      {abierta && (
        <div className="px-3 pb-4 space-y-3">
          {!esPrestable && (
            <div className="flex gap-2">
              <button
                onClick={() => setComprando(true)}
                className={`${BTN} flex-1 bg-green-600/90 text-white hover:bg-green-500`}
              >
                <ShoppingCart size={18} /> Comprar
              </button>
              <button
                onClick={() => setEntregando(true)}
                disabled={v.stock_efectivo <= 0}
                className={`${BTN} flex-1 bg-blue-600/90 text-white hover:bg-blue-500`}
              >
                <HardHat size={18} /> Entregar
              </button>
              <button
                onClick={() => setAjustando(true)}
                title="Ajustar tras conteo físico"
                className={`${BTN} bg-gray-700 text-gray-300 hover:bg-gray-600 px-3`}
              >
                <ClipboardCheck size={18} />
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setEditando(true)}
              className={`${BTN} flex-1 bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs`}
            >
              <Pencil size={14} /> Editar variante
            </button>
            <button
              onClick={() => borrarVariante.mutate()}
              disabled={borrarVariante.isLoading}
              className={`${BTN} bg-gray-700 text-gray-400 hover:bg-red-900/40 hover:text-red-300 px-3`}
              title="Eliminar variante"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Códigos de la variante
              </p>
              <button
                onClick={() => setAgregandoCodigo(true)}
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 min-h-[32px] px-1"
              >
                <Plus size={14} /> Agregar
              </button>
            </div>
            {v.codigos.length ? (
              <div className="flex flex-wrap gap-1.5">
                {v.codigos.map((c) => (
                  <ChipCodigo key={c.id} c={c} editable />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Sin códigos</p>
            )}
          </div>

          {esPrestable && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Ejemplares ({unidades.length})
                </p>
                <AltaUnidades v={v} />
              </div>
              <ListaUnidades v={v} unidades={unidades} />
            </div>
          )}
        </div>
      )}

      {comprando && <ModalCompra v={v} onClose={() => setComprando(false)} />}
      {entregando && <ModalEntrega v={v} onClose={() => setEntregando(false)} />}
      {agregandoCodigo && <ModalCodigo v={v} onClose={() => setAgregandoCodigo(false)} />}
      {editando && <ModalEditarVariante v={v} onClose={() => setEditando(false)} />}
      {ajustando && <ModalAjuste v={v} onClose={() => setAjustando(false)} />}
    </div>
  );
}

function TarjetaProducto({ p }: { p: Producto }) {
  const [agregandoVariante, setAgregandoVariante] = useState(false);
  const [editandoProducto, setEditandoProducto] = useState(false);
  const qc = useQueryClient();

  const borrarProducto = useMutation(() => catalogoApi.deleteProducto(p.id), {
    onSuccess: () => qc.invalidateQueries("productos"),
    onError: (e: any) => alert(mensajeError(e, "No se pudo eliminar el producto")),
  });

  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden">
      <div className="px-3 py-3 flex items-start gap-3">
        {p.comportamiento === "prestable" ? (
          <Wrench size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
        ) : (
          <Layers size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-white font-medium truncate">{p.nombre}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-lg border px-2 py-0.5 ${COLORES[p.family.color] ?? COLORES.blue}`}>
              {p.family.nombre}
            </span>
            {p.brand_nombre && <span className="text-gray-400">{p.brand_nombre}</span>}
            <span className="text-gray-500">
              {p.variantes.length} variante{p.variantes.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setAgregandoVariante(true)}
            title="Nueva variante"
            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 min-h-[44px] px-2"
          >
            <Plus size={16} /> Variante
          </button>
          <button
            onClick={() => setEditandoProducto(true)}
            title="Editar producto"
            className="text-gray-400 hover:text-white min-h-[44px] px-2"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => borrarProducto.mutate()}
            title="Eliminar producto"
            className="text-gray-400 hover:text-red-400 min-h-[44px] px-2"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {p.variantes.map((v) => (
        <FilaVariante key={v.id} v={v} />
      ))}

      {agregandoVariante && (
        <ModalVariante producto={p} onClose={() => setAgregandoVariante(false)} />
      )}
      {editandoProducto && (
        <ModalProducto producto={p} onClose={() => setEditandoProducto(false)} />
      )}
    </div>
  );
}

export function Catalogo() {
  const qc = useQueryClient();
  const inputFile = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [error, setError] = useState("");
  const [buscar, setBuscar] = useState("");
  const [filtro, setFiltro] = useState<string>("");
  const [creandoProducto, setCreandoProducto] = useState(false);

  const { data: productos = [], isLoading } = useQuery<Producto[]>(
    ["productos", filtro, buscar],
    () =>
      catalogoApi
        .listProductos({ comportamiento: filtro || undefined, buscar: buscar || undefined })
        .then((r) => r.data)
  );

  function fallo(e: any, porDefecto: string) {
    const d = e?.response?.data?.detail;
    setError(typeof d === "string" ? d : d?.message ?? porDefecto);
  }

  const validar = useMutation(() => catalogoApi.importValidate(archivo!), {
    onSuccess: (r) => {
      setReporte(r.data);
      setError("");
    },
    onError: (e) => fallo(e, "No se pudo validar el archivo"),
  });

  const confirmar = useMutation(() => catalogoApi.importConfirm(archivo!), {
    onSuccess: (r) => {
      setReporte(r.data);
      setArchivo(null);
      if (inputFile.current) inputFile.current.value = "";
      qc.invalidateQueries("productos");
      setError("");
    },
    onError: (e) => fallo(e, "No se pudo importar el archivo"),
  });

  async function descargarTemplate() {
    try {
      const r = await catalogoApi.importTemplate();
      // Con el tipo MIME explícito: sin él el blob queda sin tipo y el navegador
      // puede abrirlo como texto en vez de entregarlo a Excel.
      const url = URL.createObjectURL(
        new Blob([r.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "catalogo.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      fallo(e, "No se pudo descargar el template");
    }
  }

  const puedeConfirmar = reporte?.dry_run && reporte.errores.length === 0;

  return (
    <TenantGuard>
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center gap-3">
          <Boxes size={26} className="text-blue-400 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-white">Catálogo</h1>
            <p className="text-xs text-gray-400">Productos, variantes y ejemplares</p>
          </div>
        </div>

        {/* ── Carga por Excel ─────────────────────────────────────────────── */}
        <section className="bg-gray-800 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-white">Carga masiva</h2>

          <div className="flex flex-wrap gap-2">
            <button onClick={descargarTemplate} className={`${BTN} bg-gray-700 text-white hover:bg-gray-600`}>
              <Download size={18} /> Descargar template
            </button>
            <label className={`${BTN} bg-gray-700 text-white hover:bg-gray-600 cursor-pointer`}>
              <Upload size={18} /> {archivo ? "Cambiar archivo" : "Elegir archivo"}
              <input
                ref={inputFile}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  setArchivo(e.target.files?.[0] ?? null);
                  setReporte(null);
                  setError("");
                }}
              />
            </label>
          </div>

          {archivo && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400 truncate flex-1 min-w-0">{archivo.name}</span>
              <button
                onClick={() => validar.mutate()}
                disabled={validar.isLoading}
                className={`${BTN} bg-blue-600 text-white hover:bg-blue-500`}
              >
                {validar.isLoading ? "Validando…" : "Validar"}
              </button>
              {puedeConfirmar && (
                <button
                  onClick={() => confirmar.mutate()}
                  disabled={confirmar.isLoading}
                  className={`${BTN} bg-green-600 text-white hover:bg-green-500`}
                >
                  {confirmar.isLoading ? "Importando…" : "Confirmar carga"}
                </button>
              )}
            </div>
          )}

          {/* El template se descarga con stock_actual y cantidad_unidades vacías:
              si el dato no está, no hay forma de pisar inventario al reimportar. */}
          <p className="text-xs text-gray-500">
            El template viene con <span className="font-mono">stock_actual</span> y{" "}
            <span className="font-mono">cantidad_unidades</span> vacías. Reimportarlo actualiza el
            catálogo sin tocar el inventario ni duplicar ejemplares.
          </p>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {reporte && (
            <div className="bg-gray-900/50 rounded-xl p-3 space-y-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {reporte.dry_run ? "Validación (nada se guardó)" : "Importación aplicada"}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {[
                  ["Productos", reporte.productos_creados],
                  ["Variantes", reporte.variantes_creadas],
                  ["Actualizadas", reporte.variantes_actualizadas],
                  ["Ejemplares", reporte.unidades_creadas],
                  ["Códigos", reporte.codigos_creados],
                  ["Proveedores", reporte.proveedores_creados],
                ].map(([label, n]) => (
                  <div key={label as string} className="bg-gray-800 rounded-lg px-2.5 py-2">
                    <p className="text-[11px] text-gray-500">{label}</p>
                    <p className="text-white font-semibold">{n as number}</p>
                  </div>
                ))}
              </div>

              {reporte.ajustes_stock.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">
                    Movimientos de stock que {reporte.dry_run ? "se generarían" : "se generaron"}
                  </p>
                  <ul className="space-y-1">
                    {reporte.ajustes_stock.map((a, i) => (
                      <li key={i} className="text-xs text-gray-300">
                        <span className="text-gray-500">fila {a.fila}</span> · {a.variante}:{" "}
                        {a.de} → <span className="text-white">{a.a}</span>{" "}
                        <span className="text-gray-500">({a.tipo})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {reporte.advertencias.length > 0 && (
                <div>
                  <p className="text-xs text-yellow-400 mb-1">Advertencias</p>
                  <ul className="space-y-1">
                    {reporte.advertencias.map((a, i) => (
                      <li key={i} className="text-xs text-yellow-200/80">
                        <span className="opacity-60">fila {a.fila}</span> · {a.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {reporte.errores.length > 0 && (
                <div>
                  <p className="text-xs text-red-400 mb-1">
                    Errores — estas filas se omiten
                  </p>
                  <ul className="space-y-1">
                    {reporte.errores.map((e, i) => (
                      <li key={i} className="text-xs text-red-300">
                        <span className="opacity-60">fila {e.fila}</span> · {e.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Listado ─────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className={INPUT}
              placeholder="Buscar producto o variante…"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
            <div className="flex gap-2">
              {[
                ["", "Todo"],
                ["consumible", "Consumibles"],
                ["prestable", "Herramientas"],
              ].map(([valor, label]) => (
                <button
                  key={label}
                  onClick={() => setFiltro(valor)}
                  className={`${BTN} flex-1 sm:flex-none ${
                    filtro === valor
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setCreandoProducto(true)}
            className={`${BTN} w-full bg-blue-600 text-white hover:bg-blue-500`}
          >
            <Plus size={18} /> Nuevo producto
          </button>

          {isLoading && <p className="text-sm text-gray-400">Cargando…</p>}

          {!isLoading && productos.length === 0 && (
            <div className="bg-gray-800 rounded-2xl p-6 text-center">
              <Package size={32} className="text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                No hay productos todavía. Descarga el template y carga tu catálogo.
              </p>
            </div>
          )}

          {productos.map((p) => (
            <TarjetaProducto key={p.id} p={p} />
          ))}

          {creandoProducto && <ModalProducto onClose={() => setCreandoProducto(false)} />}
        </section>
      </div>
    </TenantGuard>
  );
}
