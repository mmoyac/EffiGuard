import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { UserCheck } from "lucide-react";
import { ROL_OPERARIO, loansApi, projectsApi, usersApi } from "../../services/api";
import { BTN, Campo, INPUT, Modal, mensajeError, type Variante } from "./shared";

type Disponible = { id: number; codigo_principal: string | null; ubicacion: string | null };
type Pieza = { id: number; codigo_principal: string | null; estado_id: number };

/**
 * Préstamo de un ejemplar.
 *
 * Si el escaneo resolvió un ejemplar concreto se presta ése; si resolvió la
 * variante (el EAN del modelo, que los tres esmeriles comparten) hay que elegir
 * cuál de los libres se lleva.
 */
export function ModalPrestamo({
  v,
  unidadId,
  onClose,
}: {
  v: Variante;
  unidadId?: number | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [elegida, setElegida] = useState<number | null>(unidadId ?? null);
  const [operarioId, setOperarioId] = useState("");
  const [operarioNombre, setOperarioNombre] = useState("");
  const [credencial, setCredencial] = useState("");
  const [errorCredencial, setErrorCredencial] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dias, setDias] = useState("");
  const [error, setError] = useState("");

  const { data: disponibles = [] } = useQuery<Disponible[]>(
    ["disponibles", v.id],
    () => loansApi.disponibles(v.id).then((r) => r.data),
    {
      enabled: !unidadId,
      onSuccess: (d) => {
        // Con un solo ejemplar libre no tiene sentido hacerlo elegir
        if (d.length === 1 && elegida === null) setElegida(d[0].id);
      },
    }
  );

  // Un kit se presta entero: mostrar sus piezas antes de confirmar evita que el
  // bodeguero descubra en el mesón que se está llevando cinco cosas.
  const { data: piezas = [] } = useQuery<Pieza[]>(
    ["kit", elegida],
    () => loansApi.piezasDelKit(elegida!).then((r) => r.data),
    { enabled: !!elegida }
  );

  const { data: usuarios = [] } = useQuery<{ id: number; nombre: string }[]>(
    "operarios",
    () => usersApi.list(ROL_OPERARIO).then((r) => r.data.items ?? r.data)
  );
  const { data: proyectos = [] } = useQuery<{ id: number; nombre: string }[]>(
    "proyectos-activos",
    () => projectsApi.list(true).then((r) => r.data)
  );

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

  const prestar = useMutation(
    () => {
      const prevista = dias
        ? new Date(Date.now() + Number(dias) * 86400000).toISOString()
        : undefined;
      return loansApi.create({
        unidad_id: elegida,
        user_id: Number(operarioId),
        ...(projectId ? { project_id: Number(projectId) } : {}),
        ...(prevista ? { fecha_devolucion_prevista: prevista } : {}),
      });
    },
    {
      onSuccess: () => {
        qc.invalidateQueries("productos");
        qc.invalidateQueries(["disponibles", v.id]);
        onClose();
      },
      onError: (e) => setError(mensajeError(e, "No se pudo registrar el préstamo")),
    }
  );

  const esKit = piezas.length > 0;

  return (
    <Modal
      titulo={esKit ? `Prestar kit (${piezas.length + 1} piezas)` : "Registrar préstamo"}
      subtitulo={`${v.producto_nombre} · ${v.nombre}`}
      onClose={onClose}
    >
      {!unidadId && (
        <Campo label={`Cuál ejemplar (${disponibles.length} disponibles)`}>
          <select
            className={INPUT}
            value={elegida ?? ""}
            onChange={(e) => setElegida(Number(e.target.value))}
          >
            <option value="">— elegir —</option>
            {disponibles.map((d) => (
              <option key={d.id} value={d.id}>
                {d.codigo_principal ?? `#${d.id}`}
                {d.ubicacion ? ` — ${d.ubicacion}` : ""}
              </option>
            ))}
          </select>
        </Campo>
      )}

      {esKit && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-2.5">
          <p className="text-xs text-purple-300 mb-1">Se lleva también:</p>
          <ul className="text-xs text-purple-200/80 font-mono space-y-0.5">
            {piezas.map((p) => (
              <li key={p.id}>▸ {p.codigo_principal ?? `#${p.id}`}</li>
            ))}
          </ul>
        </div>
      )}

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
          <span className="text-sm text-green-300 truncate">Recibe {operarioNombre}</span>
        </div>
      )}

      <Campo label="…o elígelo de la lista">
        <select
          className={INPUT}
          value={operarioId}
          onChange={(e) => {
            setOperarioId(e.target.value);
            setOperarioNombre(usuarios.find((u) => String(u.id) === e.target.value)?.nombre ?? "");
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

      <div className="grid grid-cols-2 gap-2">
        <Campo label="Proyecto (opcional)">
          <select className={INPUT} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— sin obra —</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Devuelve en (días)">
          <input
            className={INPUT}
            inputMode="numeric"
            placeholder="hereda el límite de la familia"
            value={dias}
            onChange={(e) => setDias(e.target.value)}
          />
        </Campo>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button onClick={onClose} className={`${BTN} flex-1 bg-gray-700 text-white`}>
          Cancelar
        </button>
        <button
          onClick={() => prestar.mutate()}
          disabled={prestar.isLoading || !elegida || !operarioId}
          className={`${BTN} flex-1 bg-blue-600 text-white hover:bg-blue-500`}
        >
          {prestar.isLoading ? "Registrando…" : esKit ? "Prestar kit" : "Prestar"}
        </button>
      </div>
    </Modal>
  );
}
