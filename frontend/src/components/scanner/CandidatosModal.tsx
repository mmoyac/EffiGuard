import { X, Package, MapPin } from "lucide-react";
import type { AssetCandidato } from "../../types";

interface Props {
  codigoFabricante: string | null;
  candidatos: AssetCandidato[];
  onSelect: (candidato: AssetCandidato) => void;
  onClose: () => void;
}

const ESTADOS: Record<number, { label: string; color: string }> = {
  1: { label: "Disponible", color: "text-green-400 bg-green-900/30 border-green-800" },
  2: { label: "En Terreno", color: "text-blue-400 bg-blue-900/30 border-blue-800" },
  3: { label: "En Reparación", color: "text-yellow-400 bg-yellow-900/30 border-yellow-800" },
  4: { label: "Robado", color: "text-red-400 bg-red-900/30 border-red-800" },
};

/**
 * El código de fábrica identifica el producto, no la unidad: si hay varias
 * unidades iguales, el bodeguero tiene que decir cuál tiene en la mano.
 */
export function CandidatosModal({ codigoFabricante, candidatos, onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start gap-3 p-5 border-b border-gray-800">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white">
              {candidatos.length} unidades de este producto
            </h3>
            {codigoFabricante && (
              <p className="text-xs text-gray-500 font-mono mt-1 truncate">
                Código de fábrica: {codigoFabricante}
              </p>
            )}
            <p className="text-sm text-gray-400 mt-2">¿Cuál estás operando?</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-2 min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <ul className="overflow-y-auto p-4 space-y-3">
          {candidatos.map((cand) => {
            const estado = ESTADOS[cand.estado_id] ?? {
              label: "Desconocido",
              color: "text-gray-400 bg-gray-800 border-gray-700",
            };
            return (
              <li key={cand.id}>
                <button
                  onClick={() => onSelect(cand)}
                  className="w-full text-left bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl p-4 min-h-[48px] transition-colors active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <Package size={20} className="text-gray-400 flex-shrink-0" />
                    <span className="font-mono text-sm text-white truncate flex-1 min-w-0">
                      {cand.uid_fisico}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full border flex-shrink-0 ${estado.color}`}>
                      {estado.label}
                    </span>
                  </div>
                  {cand.ubicacion && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                      <MapPin size={13} className="flex-shrink-0" />
                      <span className="truncate">
                        Rack {cand.ubicacion.rack} · Nivel {cand.ubicacion.nivel} · Pos {cand.ubicacion.posicion}
                      </span>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
