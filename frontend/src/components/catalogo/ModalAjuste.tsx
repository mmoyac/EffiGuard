import { useState } from "react";
import { useMutation, useQueryClient } from "react-query";
import { ClipboardCheck } from "lucide-react";
import { catalogoApi } from "../../services/api";
import { BTN, Campo, INPUT, Modal, mensajeError, type Variante } from "./shared";

/**
 * Ajuste de inventario tras un conteo físico.
 *
 * Es la única vía para corregir existencias, y no edita en silencio: deja un
 * movimiento con la diferencia. Un stock que salta sin explicación convierte la
 * bitácora en decoración.
 *
 * Se pide el número contado y no la diferencia porque es lo que el bodeguero tiene
 * en la mano al terminar de contar; calcular la resta a mano es una oportunidad
 * más de equivocarse.
 */
export function ModalAjuste({ v, onClose }: { v: Variante; onClose: () => void }) {
  const qc = useQueryClient();
  const [contado, setContado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");

  const n = contado === "" ? null : Number(contado.replace(",", ".")) || 0;
  const diferencia = n === null ? null : n - v.stock_efectivo;

  const ajustar = useMutation(
    () =>
      catalogoApi.adjust(v.id, {
        stock_nuevo: n,
        ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
      }),
    {
      onSuccess: () => {
        qc.invalidateQueries("productos");
        qc.invalidateQueries(["movimientos", v.id]);
        onClose();
      },
      onError: (e) => setError(mensajeError(e, "No se pudo ajustar el stock")),
    }
  );

  return (
    <Modal
      titulo="Ajustar inventario"
      subtitulo={`${v.producto_nombre} · ${v.nombre}`}
      onClose={onClose}
    >
      <div className="bg-gray-900/50 rounded-xl px-3 py-2.5 text-sm flex justify-between">
        <span className="text-gray-400">El sistema dice</span>
        <span className="text-white font-semibold">
          {v.stock_efectivo} {v.unidad}
        </span>
      </div>

      <Campo label={`Cuántas ${v.unidad} contaste`}>
        <input
          className={INPUT}
          inputMode="decimal"
          autoFocus
          placeholder="El resultado del conteo, no la diferencia"
          value={contado}
          onChange={(e) => setContado(e.target.value)}
        />
      </Campo>

      {diferencia !== null && diferencia !== 0 && (
        <div
          className={`rounded-xl px-3 py-2.5 text-sm flex justify-between border ${
            diferencia < 0
              ? "bg-amber-500/10 border-amber-500/30"
              : "bg-green-500/10 border-green-500/30"
          }`}
        >
          <span className={diferencia < 0 ? "text-amber-300" : "text-green-300"}>
            {diferencia < 0 ? "Faltan" : "Sobran"}
          </span>
          <span className="font-semibold text-white">
            {Math.abs(diferencia)} {v.unidad}
          </span>
        </div>
      )}

      <Campo label="Motivo (opcional)">
        <input
          className={INPUT}
          placeholder="Conteo del 3 de agosto"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </Campo>

      {/* Un faltante puede ser merma o robo, y son cosas distintas en el costeo */}
      {diferencia !== null && diferencia < 0 && (
        <p className="text-xs text-gray-500">
          Si sabes qué pasó con lo que falta —se dañó, se lo llevaron— regístralo como
          merma o pérdida: el ajuste sólo dice que el número no cuadraba.
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button onClick={onClose} className={`${BTN} flex-1 bg-gray-700 text-white`}>
          Cancelar
        </button>
        <button
          onClick={() => ajustar.mutate()}
          disabled={ajustar.isLoading || n === null || n < 0 || diferencia === 0}
          className={`${BTN} flex-1 bg-blue-600 text-white hover:bg-blue-500`}
        >
          <ClipboardCheck size={18} />
          {ajustar.isLoading ? "Ajustando…" : "Ajustar"}
        </button>
      </div>
    </Modal>
  );
}
