import { useState } from "react";
import { useQuery, useQueryClient } from "react-query";
import { MapPin, Plus, X } from "lucide-react";
import { ubicacionesApi } from "../../services/api";
import type { Ubicacion } from "../../types";

interface Props {
  /** Ubicación actual del activo, para inicializar los selectores. */
  actual: Ubicacion | null;
  value: number | null;
  onChange: (ubicacionId: number | null) => void;
}

const SELECT_CLASS =
  "bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full min-h-[48px]";

/**
 * Selectores en cascada derivados del catálogo: rack → niveles de ese rack →
 * posiciones de ese nivel. Un 'nivel 5' no existe con independencia de su rack,
 * por eso cada paso consulta al anterior en vez de listar todo junto.
 *
 * Incluye creación inline: el bodeguero está guardando una caja, no configurando
 * el sistema, así que no puede quedar bloqueado si la posición aún no existe.
 */
export function UbicacionPicker({ actual, value, onChange }: Props) {
  const qc = useQueryClient();
  const [rack, setRack] = useState(actual?.rack ?? "");
  const [nivel, setNivel] = useState(actual?.nivel ?? "");
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState({ rack: "", nivel: "", posicion: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const { data: racks = [] } = useQuery<string[]>("ubicaciones-racks", () =>
    ubicacionesApi.racks().then((r) => r.data)
  );
  const { data: niveles = [] } = useQuery<string[]>(
    ["ubicaciones-niveles", rack],
    () => ubicacionesApi.niveles(rack).then((r) => r.data),
    { enabled: !!rack }
  );
  const { data: posiciones = [] } = useQuery<Ubicacion[]>(
    ["ubicaciones-posiciones", rack, nivel],
    () => ubicacionesApi.posiciones(rack, nivel).then((r) => r.data),
    { enabled: !!rack && !!nivel }
  );

  function limpiar() {
    setRack("");
    setNivel("");
    onChange(null);
  }

  async function crear() {
    const { rack: r, nivel: n, posicion: p } = nueva;
    if (!r.trim() || !n.trim() || !p.trim()) {
      setError("Rack, nivel y posición son obligatorios");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const { data } = await ubicacionesApi.create({ rack: r, nivel: n, posicion: p });
      await qc.invalidateQueries("ubicaciones-racks");
      setRack(data.rack);
      setNivel(data.nivel);
      onChange(data.id);
      setCreando(false);
      setNueva({ rack: "", nivel: "", posicion: "" });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      // El 409 trae la ubicación existente: se selecciona en vez de duplicarla
      if (err?.response?.status === 409 && detail?.existente) {
        setRack(detail.existente.rack);
        setNivel(detail.existente.nivel);
        onChange(detail.existente.id);
        setCreando(false);
        setNueva({ rack: "", nivel: "", posicion: "" });
      } else {
        setError(typeof detail === "string" ? detail : "Error al crear la ubicación");
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
          <MapPin size={14} className="text-gray-400" />
          Ubicación en bodega
        </label>
        {value && (
          <button
            type="button"
            onClick={limpiar}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1"
          >
            Quitar
          </button>
        )}
      </div>

      {!creando ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={rack}
              onChange={(e) => { setRack(e.target.value); setNivel(""); onChange(null); }}
              className={SELECT_CLASS}
            >
              <option value="">Rack</option>
              {racks.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <select
              value={nivel}
              onChange={(e) => { setNivel(e.target.value); onChange(null); }}
              disabled={!rack}
              className={`${SELECT_CLASS} disabled:opacity-40`}
            >
              <option value="">Nivel</option>
              {niveles.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>

            <select
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
              disabled={!nivel}
              className={`${SELECT_CLASS} disabled:opacity-40`}
            >
              <option value="">Pos.</option>
              {posiciones.map((p) => <option key={p.id} value={p.id}>{p.posicion}</option>)}
            </select>
          </div>

          <button
            type="button"
            onClick={() => { setCreando(true); setError(""); }}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors px-1 py-2"
          >
            <Plus size={14} /> Crear ubicación nueva
          </button>
        </>
      ) : (
        <div className="bg-gray-700/60 border border-gray-600 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-400">Nueva ubicación</p>
            <button
              type="button"
              onClick={() => { setCreando(false); setError(""); }}
              className="text-gray-500 hover:text-white p-1"
            >
              <X size={16} />
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-2 py-1.5 rounded-lg">{error}</p>
          )}

          <div className="grid grid-cols-3 gap-2">
            <input placeholder="Rack" value={nueva.rack}
              onChange={(e) => setNueva({ ...nueva, rack: e.target.value })} className={SELECT_CLASS} />
            <input placeholder="Nivel" value={nueva.nivel}
              onChange={(e) => setNueva({ ...nueva, nivel: e.target.value })} className={SELECT_CLASS} />
            <input placeholder="Posición" value={nueva.posicion}
              onChange={(e) => setNueva({ ...nueva, posicion: e.target.value })} className={SELECT_CLASS} />
          </div>

          <button
            type="button"
            onClick={crear}
            disabled={guardando}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors min-h-[48px]"
          >
            {guardando ? "Creando..." : "Crear y seleccionar"}
          </button>
        </div>
      )}
    </div>
  );
}
