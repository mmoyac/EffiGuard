import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { UserCheck } from "lucide-react";
import { catalogoApi, projectsApi, usersApi } from "../../services/api";
import { BTN, Campo, INPUT, Modal, mensajeError, type Variante } from "./shared";

/**
 * Entrega de consumible a un operario.
 *
 * No genera préstamo: un tornillo no se devuelve. Lo que sobra de una obra vuelve
 * por reintegro, que es otro movimiento.
 */
export function ModalEntrega({ v, onClose }: { v: Variante; onClose: () => void }) {
  const qc = useQueryClient();
  const [cantidad, setCantidad] = useState("1");
  const [operarioId, setOperarioId] = useState("");
  const [operarioNombre, setOperarioNombre] = useState("");
  const [credencial, setCredencial] = useState("");
  const [errorCredencial, setErrorCredencial] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");

  /**
   * Escaneo de la credencial del operario.
   *
   * Es la vía principal, no un extra: quien despacha lo hace con guantes y elegir
   * de una lista de cincuenta nombres es donde se equivoca. El capturador HID
   * global ignora las teclas mientras el foco está en un input, así que la ráfaga
   * del lector cae acá y no se interpreta como un código de producto.
   */
  async function resolverCredencial(uid: string) {
    const limpio = uid.trim();
    if (!limpio) return;
    setErrorCredencial("");
    try {
      const r = await usersApi.scanByCredential(limpio);
      setOperarioId(String(r.data.id));
      setOperarioNombre(r.data.nombre);
      setCredencial("");
    } catch (e) {
      setErrorCredencial(mensajeError(e, "Credencial no encontrada"));
      setTimeout(() => setErrorCredencial(""), 4000);
    }
  }

  const { data: usuarios = [] } = useQuery<{ id: number; nombre: string }[]>(
    "usuarios-entrega",
    () => usersApi.list().then((r) => r.data.items ?? r.data)
  );
  const { data: proyectos = [] } = useQuery<{ id: number; nombre: string }[]>(
    "proyectos-entrega",
    () => projectsApi.list().then((r) => r.data)
  );

  const n = Number(cantidad.replace(",", ".")) || 0;
  const restante = v.stock_efectivo - n;

  const entregar = useMutation(
    () =>
      catalogoApi.withdraw(v.id, {
        cantidad: n,
        operario_id: Number(operarioId),
        ...(projectId ? { project_id: Number(projectId) } : {}),
      }),
    {
      onSuccess: () => {
        qc.invalidateQueries("productos");
        qc.invalidateQueries(["movimientos", v.id]);
        onClose();
      },
      onError: (e) => setError(mensajeError(e, "No se pudo registrar la entrega")),
    }
  );

  return (
    <Modal
      titulo="Entregar a operario"
      subtitulo={`${v.producto_nombre} · ${v.nombre}`}
      onClose={onClose}
    >
      <Campo label="Escanea la credencial del operario">
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

      {operarioNombre && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <UserCheck size={18} className="text-green-400 flex-shrink-0" />
          <span className="text-sm text-green-300 truncate">Retira {operarioNombre}</span>
        </div>
      )}

      {/* Sin lector, o con la credencial perdida, la lista sigue estando */}
      <Campo label="…o elígelo de la lista">
        <select
          className={INPUT}
          value={operarioId}
          onChange={(e) => {
            setOperarioId(e.target.value);
            setOperarioNombre(
              usuarios.find((u) => String(u.id) === e.target.value)?.nombre ?? ""
            );
          }}
        >
          <option value="">— elegir —</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label={`Cuántas ${v.unidad}`}>
        <input
          className={INPUT}
          inputMode="decimal"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />
      </Campo>

      <Campo label="Proyecto (opcional)">
        <select className={INPUT} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">— sin proyecto —</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Sin proyecto el consumo no se imputa a ninguna obra.
        </p>
      </Campo>

      <div className="bg-gray-900/50 rounded-xl px-3 py-2.5 text-sm flex justify-between">
        <span className="text-gray-400">Stock queda en</span>
        <span className={`font-semibold ${restante < 0 ? "text-red-400" : "text-green-400"}`}>
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
          onClick={() => entregar.mutate()}
          disabled={entregar.isLoading || n <= 0 || restante < 0 || !operarioId}
          className={`${BTN} flex-1 bg-blue-600 text-white hover:bg-blue-500`}
        >
          {entregar.isLoading ? "Registrando…" : "Entregar"}
        </button>
      </div>
    </Modal>
  );
}
