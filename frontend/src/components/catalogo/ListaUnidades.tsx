import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { MapPin, Printer, Trash2, Wrench } from "lucide-react";
import { catalogoApi, ubicacionesApi } from "../../services/api";
import { LabelPreviewModal } from "../LabelPreviewModal";
import { BTN, INPUT, mensajeError, type Unidad, type Variante } from "./shared";

type Ubicacion = { id: number; rack: string; nivel: string; posicion: string };

const ESTADOS: Record<number, { label: string; clase: string; punto: string }> = {
  1: { label: "Disponible", clase: "text-green-300", punto: "bg-green-500" },
  2: { label: "En Terreno", clase: "text-orange-300", punto: "bg-orange-500" },
  3: { label: "En Reparación", clase: "text-yellow-300", punto: "bg-yellow-500" },
  4: { label: "Robado", clase: "text-red-300", punto: "bg-red-500" },
};

/**
 * Ejemplares de una variante prestable.
 *
 * El estado no se edita acá: lo mueven el préstamo, la devolución, la reparación
 * y la pérdida, de modo que cada cambio quede explicado por el hecho que lo causó.
 * Lo que sí se corrige es dónde está guardado y cuándo toca su mantención.
 */
export function ListaUnidades({ v, unidades }: { v: Variante; unidades: Unidad[] }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<number | null>(null);
  const [etiqueta, setEtiqueta] = useState<Unidad | null>(null);

  const { data: ubicaciones = [] } = useQuery<Ubicacion[]>(
    "ubicaciones",
    () => ubicacionesApi.list().then((r) => r.data),
    { enabled: editando !== null }
  );

  function refrescar() {
    qc.invalidateQueries("productos");
    qc.invalidateQueries(["unidades", v.id]);
  }

  const mover = useMutation(
    ({ id, ubicacion_id }: { id: number; ubicacion_id: number | null }) =>
      catalogoApi.updateUnidad(id, { ubicacion_id }),
    {
      onSuccess: () => {
        refrescar();
        setEditando(null);
      },
      onError: (e: any) => alert(mensajeError(e, "No se pudo mover el ejemplar")),
    }
  );

  const borrar = useMutation((id: number) => catalogoApi.deleteUnidad(id), {
    onSuccess: refrescar,
    // El backend bloquea con préstamo abierto o historial, y dice por qué
    onError: (e: any) => alert(mensajeError(e, "No se pudo eliminar el ejemplar")),
  });

  return (
    <div className="space-y-1.5">
      {unidades.map((u) => {
        const estado = ESTADOS[u.estado_id] ?? ESTADOS[1];
        return (
          <div key={u.id} className="bg-gray-900/40 rounded-lg px-2 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${estado.punto}`}
                title={estado.label}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono text-white truncate">
                  {u.codigo_principal ?? `#${u.id}`}
                </p>
                <p className={`text-[11px] ${estado.clase}`}>
                  {estado.label}
                  {u.ubicacion && (
                    <span className="text-gray-500">
                      {" · "}
                      {u.ubicacion.rack}/{u.ubicacion.nivel}/{u.ubicacion.posicion}
                    </span>
                  )}
                  {u.proxima_mantencion && (
                    <span className="text-gray-500"> · mant. {u.proxima_mantencion}</span>
                  )}
                </p>
              </div>

              <button
                onClick={() => setEtiqueta(u)}
                title="Imprimir etiqueta"
                className="text-gray-500 hover:text-white p-1.5"
              >
                <Printer size={14} />
              </button>
              <button
                onClick={() => setEditando(editando === u.id ? null : u.id)}
                title="Cambiar ubicación"
                className="text-gray-500 hover:text-white p-1.5"
              >
                <MapPin size={14} />
              </button>
              <button
                onClick={() => borrar.mutate(u.id)}
                title="Eliminar ejemplar"
                className="text-gray-500 hover:text-red-400 p-1.5"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {editando === u.id && (
              <select
                className={INPUT}
                defaultValue={u.ubicacion_id ? String(u.ubicacion_id) : ""}
                onChange={(e) =>
                  mover.mutate({
                    id: u.id,
                    ubicacion_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">— sin ubicación —</option>
                {ubicaciones.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.rack}/{x.nivel}/{x.posicion}
                  </option>
                ))}
              </select>
            )}

            {u.codigos.length > 1 && (
              <p className="text-[10px] text-gray-500 font-mono truncate">
                {u.codigos
                  .filter((c) => !c.es_principal)
                  .map((c) => c.codigo)
                  .join(" · ")}
              </p>
            )}
          </div>
        );
      })}

      {etiqueta && (
        <LabelPreviewModal
          title={v.producto_nombre}
          subtitle={v.nombre}
          uid={etiqueta.codigo_principal ?? String(etiqueta.id)}
          onClose={() => setEtiqueta(null)}
        />
      )}
    </div>
  );
}

/** Alta de más ejemplares sobre una variante que ya existe. */
export function AltaUnidades({ v }: { v: Variante }) {
  const qc = useQueryClient();
  const [cantidad, setCantidad] = useState("1");
  const [abierto, setAbierto] = useState(false);

  const crear = useMutation(
    () => catalogoApi.createUnidades(v.id, { cantidad: Number(cantidad) || 1 }),
    {
      onSuccess: () => {
        qc.invalidateQueries("productos");
        qc.invalidateQueries(["unidades", v.id]);
        setAbierto(false);
        setCantidad("1");
      },
      onError: (e: any) => alert(mensajeError(e, "No se pudo crear los ejemplares")),
    }
  );

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 min-h-[32px] px-1"
      >
        <Wrench size={14} /> Recibir más ejemplares
      </button>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        className={`${INPUT} flex-1`}
        inputMode="numeric"
        autoFocus
        value={cantidad}
        onChange={(e) => setCantidad(e.target.value)}
      />
      <button onClick={() => setAbierto(false)} className={`${BTN} bg-gray-700 text-white px-3`}>
        Cancelar
      </button>
      <button
        onClick={() => crear.mutate()}
        disabled={crear.isLoading}
        className={`${BTN} bg-blue-600 text-white px-3`}
      >
        {crear.isLoading ? "Creando…" : "Crear"}
      </button>
    </div>
  );
}
