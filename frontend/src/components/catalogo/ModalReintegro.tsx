import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Undo2 } from "lucide-react";
import { catalogoApi } from "../../services/api";
import { BTN, Campo, INPUT, Modal, mensajeError, type Variante } from "./shared";

type Despacho = {
  despacho_id: number;
  cantidad_despachada: number;
  cantidad_reintegrada: number;
  saldo_pendiente: number;
  fecha_hora: string;
  operario_nombre: string | null;
  proyecto_nombre: string | null;
};

/**
 * Reintegro de sobrante.
 *
 * Va contra un despacho concreto y no contra el stock a secas: es lo que permite
 * validar que no vuelva más de lo que salió, y heredar el operario y el proyecto
 * para que el consumo neto de la obra quede bien imputado. Lo que no vuelve es
 * consumo real, no una pérdida.
 */
export function ModalReintegro({ v, onClose }: { v: Variante; onClose: () => void }) {
  const qc = useQueryClient();
  const [despachoId, setDespachoId] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");

  const { data: despachos = [], isLoading } = useQuery<Despacho[]>(
    ["despachos-pendientes", v.id],
    () => catalogoApi.despachosPendientes(v.id).then((r) => r.data),
    {
      onSuccess: (d) => {
        // Con un solo despacho abierto no tiene sentido hacerlo elegir
        if (d.length === 1 && despachoId === null) {
          setDespachoId(d[0].despacho_id);
          setCantidad(String(d[0].saldo_pendiente));
        }
      },
    }
  );

  const elegido = despachos.find((d) => d.despacho_id === despachoId) ?? null;
  const n = Number(cantidad.replace(",", ".")) || 0;
  const excede = elegido ? n > elegido.saldo_pendiente : false;

  const registrar = useMutation(
    () =>
      catalogoApi.reintegro(v.id, {
        origen_log_id: despachoId,
        cantidad: n,
        ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
      }),
    {
      onSuccess: () => {
        qc.invalidateQueries("productos");
        qc.invalidateQueries(["movimientos", v.id]);
        qc.invalidateQueries(["despachos-pendientes", v.id]);
        onClose();
      },
      onError: (e) => setError(mensajeError(e, "No se pudo registrar el reintegro")),
    }
  );

  return (
    <Modal
      titulo="Reintegrar sobrante"
      subtitulo={`${v.producto_nombre} · ${v.nombre}`}
      onClose={onClose}
    >
      {isLoading && <p className="text-sm text-gray-400">Buscando despachos…</p>}

      {!isLoading && despachos.length === 0 && (
        <p className="text-sm text-gray-400 bg-gray-900/50 rounded-xl px-3 py-2.5">
          No hay entregas abiertas de esta variante. Un despacho se cierra al recibir
          su reintegro, o cuando la obra termina y lo que salió queda declarado como
          consumo.
        </p>
      )}

      {despachos.length > 0 && (
        <>
          <Campo label="Contra qué entrega vuelve">
            <select
              className={INPUT}
              value={despachoId ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                setDespachoId(id);
                const d = despachos.find((x) => x.despacho_id === id);
                if (d) setCantidad(String(d.saldo_pendiente));
              }}
            >
              <option value="">— elegir —</option>
              {despachos.map((d) => (
                <option key={d.despacho_id} value={d.despacho_id}>
                  {new Date(d.fecha_hora).toLocaleDateString()} · {d.operario_nombre ?? "—"}
                  {d.proyecto_nombre ? ` · ${d.proyecto_nombre}` : ""} — quedan{" "}
                  {d.saldo_pendiente} {v.unidad}
                </option>
              ))}
            </select>
          </Campo>

          {elegido && (
            <div className="bg-gray-900/50 rounded-xl px-3 py-2.5 text-sm space-y-1">
              <div className="flex justify-between text-gray-400">
                <span>Se despacharon</span>
                <span className="text-white">
                  {elegido.cantidad_despachada} {v.unidad}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Saldo que puede volver</span>
                <span className="text-cyan-300">
                  {elegido.saldo_pendiente} {v.unidad}
                </span>
              </div>
            </div>
          )}

          <Campo label={`Cuántas ${v.unidad} vuelven`}>
            <input
              className={INPUT}
              inputMode="decimal"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Lo que no vuelva queda como consumo del proyecto, no como pérdida.
            </p>
          </Campo>

          <Campo label="Observaciones (opcional)">
            <input
              className={INPUT}
              placeholder="Sobró de la instalación del piso 3"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </Campo>

          {excede && (
            <p className="text-sm text-yellow-400">
              No puede volver más de lo que salió: el saldo es {elegido?.saldo_pendiente}.
            </p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </>
      )}

      <div className="flex gap-2">
        <button onClick={onClose} className={`${BTN} flex-1 bg-gray-700 text-white`}>
          {despachos.length ? "Cancelar" : "Cerrar"}
        </button>
        {despachos.length > 0 && (
          <button
            onClick={() => registrar.mutate()}
            disabled={registrar.isLoading || !despachoId || n <= 0 || excede}
            className={`${BTN} flex-1 bg-cyan-600 text-white hover:bg-cyan-500`}
          >
            <Undo2 size={18} />
            {registrar.isLoading ? "Registrando…" : "Reintegrar"}
          </button>
        )}
      </div>
    </Modal>
  );
}
