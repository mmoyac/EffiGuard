/**
 * Códigos de una variante: el chip, el alta y la sección que los agrupa.
 *
 * Viven acá y no en `pages/Catalogo.tsx` porque los monta también el modal de
 * edición y el escáner. Un usuario que quería cambiar un EAN13 abrió "Editar
 * variante", no los encontró —estaban diez píxeles más abajo, en el panel— y
 * concluyó que no se podía. La capacidad estaba; el camino hacia ella, no.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Plus, Star, Trash2 } from "lucide-react";
import { catalogoApi } from "../../services/api";
import {
  BTN,
  Campo,
  INPUT,
  Modal,
  TIPO_ESTILO,
  mensajeError,
  type Codigo,
  type Variante,
} from "./shared";

// Sólo los que identifican QUÉ es algo: `serie_fabrica` identifica un ejemplar
// concreto y el backend lo rechaza sobre una variante.
//
// El cuarto elemento dice si el tipo admite proveedor. Un `fabricante` viene
// impreso de fábrica y es el mismo para todos los que lo venden; un `propio` lo
// asigna el tenant. Ofrecerles proveedor contradice lo que son — y el formulario
// llegó a decir "igual para todos los proveedores" con el campo justo debajo.
const TIPOS_DE_VARIANTE = [
  ["proveedor", "Código del proveedor", "El número con que este proveedor lo vende", true],
  ["empaque", "Código del empaque", "La caja, rollo o saco — indica cuántas trae", true],
  ["fabricante", "EAN de fábrica", "El que viene impreso, igual para todos los proveedores", false],
  ["propio", "Código interno", "El que asignas tú, para tu propia etiqueta", false],
] as const;

function admiteProveedor(tipo: string): boolean {
  return TIPOS_DE_VARIANTE.find(([t]) => t === tipo)?.[3] ?? false;
}

export function ChipCodigo({ c, editable = false }: { c: Codigo; editable?: boolean }) {
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

export function ModalCodigo({
  v,
  codigoInicial,
  onClose,
  onCreado,
}: {
  v: Variante;
  /** Precargado y bloqueado cuando viene de un escaneo: retipearlo sólo introduce errores */
  codigoInicial?: string;
  onClose: () => void;
  onCreado?: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    codigo: codigoInicial ?? "",
    tipo: "proveedor",
    factor: "1",
    nombre_empaque: "caja",
    proveedor_id: "",
  });
  const [nuevoProveedor, setNuevoProveedor] = useState("");
  const [error, setError] = useState("");
  const esEmpaque = f.tipo === "empaque";
  const conProveedor = admiteProveedor(f.tipo);

  const { data: proveedores = [] } = useQuery<{ id: number; nombre: string }[]>(
    "proveedores",
    () => catalogoApi.listProveedores().then((r) => r.data)
  );

  /**
   * Al cambiar de tipo se descarta el proveedor si el nuevo no lo admite.
   * Ocultarlo dejando el valor enviaría un `proveedor_id` que el usuario ya no
   * ve: el dato invisible que después nadie sabe explicar.
   */
  function cambiarTipo(tipo: string) {
    setF((prev) =>
      admiteProveedor(tipo)
        ? { ...prev, tipo }
        : { ...prev, tipo, proveedor_id: "" }
    );
    if (!admiteProveedor(tipo)) setNuevoProveedor("");
  }

  const crear = useMutation(
    async () => {
      let proveedorId = conProveedor && f.proveedor_id ? Number(f.proveedor_id) : null;
      // Crear el proveedor al vuelo evita mandar al bodeguero a otra pantalla
      // en medio de la carga de un código.
      if (conProveedor && !proveedorId && nuevoProveedor.trim()) {
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
        onCreado?.();
        onClose();
      },
      // El 409 del backend nombra el item que ya tiene el código
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
          className={`${INPUT} font-mono ${codigoInicial ? "opacity-70" : ""}`}
          placeholder="Escanéalo o escríbelo"
          autoFocus={!codigoInicial}
          readOnly={!!codigoInicial}
          value={f.codigo}
          onChange={(e) => setF({ ...f, codigo: e.target.value })}
        />
        {codigoInicial && (
          <p className="text-xs text-gray-500 mt-1">Recién escaneado</p>
        )}
      </Campo>

      <Campo label="Qué es este código">
        <select className={INPUT} value={f.tipo} onChange={(e) => cambiarTipo(e.target.value)}>
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

      {/* Sólo donde significa algo: ver TIPOS_DE_VARIANTE */}
      {conProveedor && (
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
      )}

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

/** La lista de códigos con su alta. La montan el panel de la variante y su modal de edición. */
export function SeccionCodigos({ v }: { v: Variante }) {
  const [agregando, setAgregando] = useState(false);

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-xs uppercase tracking-wide text-gray-500">Códigos de la variante</p>
        <button
          type="button"
          onClick={() => setAgregando(true)}
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

      {agregando && <ModalCodigo v={v} onClose={() => setAgregando(false)} />}
    </div>
  );
}
