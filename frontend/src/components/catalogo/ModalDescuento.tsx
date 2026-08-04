import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { catalogoApi, projectsApi } from "../../services/api";
import { BTN, Campo, INPUT, Modal, mensajeError, type Variante } from "./shared";

/**
 * Merma y pérdida: el mismo formulario con distinta causa.
 *
 * Se mantienen separadas en la bitácora a propósito. Si el robo se diluye dentro
 * de la merma nadie lo ve, que es justamente lo que este sistema existe para
 * exponer — por eso son dos tipos de movimiento y no un campo "motivo".
 */
export function ModalDescuento({
  v,
  tipo,
  onClose,
}: {
  v: Variante;
  tipo: "merma" | "perdida";
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [cantidad, setCantidad] = useState("1");
  const [projectId, setProjectId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");

  const { data: proyectos = [] } = useQuery<{ id: number; nombre: string }[]>(
    "proyectos-entrega",
    () => projectsApi.list().then((r) => r.data)
  );

  const n = Number(cantidad.replace(",", ".")) || 0;
  const restante = v.stock_efectivo - n;
  const esMerma = tipo === "merma";

  const registrar = useMutation(
    () => {
      const payload = {
        cantidad: n,
        ...(projectId ? { project_id: Number(projectId) } : {}),
        ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
      };
      return esMerma ? catalogoApi.shrinkage(v.id, payload) : catalogoApi.loss(v.id, payload);
    },
    {
      onSuccess: () => {
        qc.invalidateQueries("productos");
        qc.invalidateQueries(["movimientos", v.id]);
        onClose();
      },
      onError: (e) => setError(mensajeError(e, "No se pudo registrar el movimiento")),
    }
  );

  return (
    <Modal
      titulo={esMerma ? "Registrar merma" : "Reportar pérdida"}
      subtitulo={`${v.producto_nombre} · ${v.nombre}`}
      onClose={onClose}
    >
      <p className="text-xs text-gray-500">
        {esMerma
          ? "Material dañado, vencido o contado de menos."
          : "Material extraviado o robado. Se contabiliza aparte de la merma para que la pérdida sea visible."}
      </p>

      <Campo label={`Cuántas ${v.unidad}`}>
        <input
          className={INPUT}
          inputMode="decimal"
          autoFocus
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />
      </Campo>

      <Campo label="Proyecto (opcional)">
        <select className={INPUT} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">— bodega, sin obra —</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label="Observaciones (opcional)">
        <input
          className={INPUT}
          placeholder={esMerma ? "Se mojó en el patio" : "Desapareció del rack"}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </Campo>

      <div className="bg-gray-900/50 rounded-xl px-3 py-2.5 text-sm flex justify-between">
        <span className="text-gray-400">Stock queda en</span>
        <span className={`font-semibold ${restante < 0 ? "text-red-400" : "text-white"}`}>
          {restante} {v.unidad}
        </span>
      </div>

      {restante < 0 && (
        <p className="text-sm text-yellow-400">
          No alcanza: hay {v.stock_efectivo} {v.unidad}.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button onClick={onClose} className={`${BTN} flex-1 bg-gray-700 text-white`}>
          Cancelar
        </button>
        <button
          onClick={() => registrar.mutate()}
          disabled={registrar.isLoading || n <= 0 || restante < 0}
          className={`${BTN} flex-1 ${
            esMerma
              ? "bg-amber-600 text-white hover:bg-amber-500"
              : "bg-red-600 text-white hover:bg-red-500"
          }`}
        >
          {registrar.isLoading ? "Registrando…" : esMerma ? "Registrar merma" : "Reportar pérdida"}
        </button>
      </div>
    </Modal>
  );
}
