import { useState } from "react";
import { useMutation, useQueryClient } from "react-query";
import { UserCheck, Wrench } from "lucide-react";
import { loansApi, usersApi } from "../../services/api";
import { BTN, Campo, INPUT, Modal, mensajeError } from "./shared";

type PrestamoActivo = {
  id: number;
  user_id: number;
  user_nombre: string;
  bodeguero_nombre: string;
  proyecto_nombre: string | null;
  fecha_entrega: string;
  asset_nombre: string | null;
  asset_uid_fisico: string | null;
};

/**
 * Devolución de un ejemplar.
 *
 * Exige confirmar quién la trae, pero no exige que sea el titular: en una obra el
 * que retiró se enfermó, renunció o está en otro frente. La responsabilidad no se
 * mueve —el préstamo sigue siendo suyo— y el movimiento anota quién la devolvió.
 */
export function ModalDevolucion({
  prestamo,
  onClose,
}: {
  prestamo: PrestamoActivo;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [credencial, setCredencial] = useState("");
  const [confirmadoId, setConfirmadoId] = useState<number | null>(null);
  const [confirmadoNombre, setConfirmadoNombre] = useState("");
  const [errorCredencial, setErrorCredencial] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [aReparacion, setAReparacion] = useState(false);
  const [error, setError] = useState("");

  async function resolverCredencial(uid: string) {
    const limpio = uid.trim();
    if (!limpio) return;
    setErrorCredencial("");
    try {
      const r = await usersApi.scanByCredential(limpio);
      setConfirmadoId(r.data.id);
      setConfirmadoNombre(r.data.nombre);
      setCredencial("");
    } catch (e) {
      setErrorCredencial(mensajeError(e, "Credencial no encontrada"));
      setTimeout(() => setErrorCredencial(""), 4000);
    }
  }

  const devolver = useMutation(
    () =>
      loansApi.return_(prestamo.id, {
        // Nunca con un valor por defecto: caer en `prestamo.user_id` convertía la
        // validación del backend en una comparación consigo misma, y el bodeguero
        // podía cerrar el préstamo sin que nadie confirmara que la herramienta volvió.
        returning_user_id: confirmadoId,
        send_to_repair: aReparacion,
        ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
      }),
    {
      onSuccess: () => {
        qc.invalidateQueries("productos");
        onClose();
      },
      onError: (e) => setError(mensajeError(e, "No se pudo registrar la devolución")),
    }
  );

  const noCoincide = confirmadoId !== null && confirmadoId !== prestamo.user_id;

  return (
    <Modal
      titulo="Registrar devolución"
      subtitulo={`${prestamo.asset_nombre ?? ""} · ${prestamo.asset_uid_fisico ?? ""}`}
      onClose={onClose}
    >
      <div className="bg-gray-900/50 rounded-xl px-3 py-2.5 text-sm space-y-1">
        <div className="flex justify-between gap-2">
          <span className="text-gray-400">La tiene</span>
          <span className="text-white">{prestamo.user_nombre}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-gray-400">Desde</span>
          <span className="text-gray-200">
            {new Date(prestamo.fecha_entrega).toLocaleDateString("es-CL")}
          </span>
        </div>
        {prestamo.proyecto_nombre && (
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Obra</span>
            <span className="text-gray-200">{prestamo.proyecto_nombre}</span>
          </div>
        )}
      </div>

      <Campo label="Escanea la credencial de quien devuelve">
        <input
          className={`${INPUT} font-mono`}
          placeholder="Acerca la credencial o el QR…"
          autoFocus
          value={credencial}
          onChange={(e) => setCredencial(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              resolverCredencial(credencial);
            }
          }}
        />
        {errorCredencial && <p className="text-sm text-red-400 mt-1">{errorCredencial}</p>}
      </Campo>

      {confirmadoNombre && (
        <div
          className={`rounded-xl px-3 py-2.5 flex items-start gap-2 border ${
            noCoincide
              ? "bg-amber-500/10 border-amber-500/30"
              : "bg-green-500/10 border-green-500/30"
          }`}
        >
          <UserCheck
            size={18}
            className={`flex-shrink-0 mt-0.5 ${noCoincide ? "text-amber-400" : "text-green-400"}`}
          />
          <div className="min-w-0">
            <p className={`text-sm truncate ${noCoincide ? "text-amber-200" : "text-green-300"}`}>
              {noCoincide ? `La trae ${confirmadoNombre}` : `Devuelve ${confirmadoNombre}`}
            </p>
            {/* La responsabilidad no se traspasa por traer la máquina de vuelta */}
            {noCoincide && (
              <p className="text-xs text-amber-300/80">
                No es quien la retiró — la responsabilidad sigue siendo de{" "}
                {prestamo.user_nombre}, y así queda en la bitácora
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sin lector, o con la credencial perdida, el bodeguero puede confirmar a
          mano — pero como acto explícito, no como valor por defecto silencioso. */}
      {confirmadoId === null && (
        <button
          onClick={() => {
            setConfirmadoId(prestamo.user_id);
            setConfirmadoNombre(prestamo.user_nombre);
          }}
          className={`${BTN} w-full bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs`}
        >
          Sin credencial — confirmo que la devuelve {prestamo.user_nombre}
        </button>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer min-h-[44px]">
        <input
          type="checkbox"
          checked={aReparacion}
          onChange={(e) => setAReparacion(e.target.checked)}
          className="w-4 h-4 accent-yellow-500"
        />
        <Wrench size={16} className="text-yellow-400" />
        Vuelve dañada — enviar a reparación
      </label>

      <Campo label="Observaciones (opcional)">
        <input
          className={INPUT}
          placeholder={aReparacion ? "Qué le pasó" : "Todo en orden"}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </Campo>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button onClick={onClose} className={`${BTN} flex-1 bg-gray-700 text-white`}>
          Cancelar
        </button>
        <button
          onClick={() => devolver.mutate()}
          disabled={devolver.isLoading || confirmadoId === null}
          className={`${BTN} flex-1 ${
            aReparacion
              ? "bg-yellow-600 text-white hover:bg-yellow-500"
              : "bg-green-600 text-white hover:bg-green-500"
          }`}
        >
          {devolver.isLoading
            ? "Registrando…"
            : aReparacion
              ? "Devolver a reparación"
              : "Devolver"}
        </button>
      </div>
    </Modal>
  );
}
