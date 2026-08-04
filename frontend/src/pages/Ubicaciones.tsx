import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { MapPin, Plus, Pencil, Trash2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { ubicacionesApi } from "../services/api";
import { TenantGuard } from "../components/layout/TenantGuard";
import type { Ubicacion } from "../types";

const INPUT =
  "bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full min-h-[48px]";

export function Ubicaciones() {
  const qc = useQueryClient();
  const [nueva, setNueva] = useState({ rack: "", nivel: "", posicion: "", descripcion: "" });
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState<Ubicacion | null>(null);
  const [racksAbiertos, setRacksAbiertos] = useState<Record<string, boolean>>({});

  const { data: ubicaciones = [], isLoading } = useQuery<Ubicacion[]>(
    "ubicaciones",
    () => ubicacionesApi.list().then((r) => r.data)
  );

  function refrescar() {
    qc.invalidateQueries("ubicaciones");
    qc.invalidateQueries("ubicaciones-racks");
    // El activo lleva la ubicación embebida: renombrar un rack la cambia
    qc.invalidateQueries("assets");
  }

  const crear = useMutation(() => ubicacionesApi.create(nueva), {
    onSuccess: () => {
      refrescar();
      setNueva({ rack: "", nivel: "", posicion: "", descripcion: "" });
      setMostrarForm(false);
      setError("");
    },
    onError: (e: any) => {
      const d = e?.response?.data?.detail;
      setError(typeof d === "string" ? d : d?.message ?? "Error al crear la ubicación");
    },
  });

  const actualizar = useMutation(
    (u: Ubicacion) => ubicacionesApi.update(u.id, {
      rack: u.rack, nivel: u.nivel, posicion: u.posicion, descripcion: u.descripcion,
    }),
    {
      onSuccess: () => { refrescar(); setEditando(null); setError(""); },
      onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al actualizar"),
    }
  );

  const eliminar = useMutation((id: number) => ubicacionesApi.remove(id), {
    onSuccess: () => { refrescar(); setError(""); },
    // El backend bloquea si tiene activos y dice cuántos son
    onError: (e: any) => setError(e?.response?.data?.detail ?? "No se puede eliminar"),
  });

  // Agrupadas por rack: es como se recorre una bodega
  const porRack = ubicaciones.reduce<Record<string, Ubicacion[]>>((acc, u) => {
    (acc[u.rack] ??= []).push(u);
    return acc;
  }, {});

  return (
    <TenantGuard>
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center gap-3 flex-wrap">
          <MapPin size={26} className="text-blue-400 flex-shrink-0" />
          <h2 className="text-2xl font-bold">Ubicaciones</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
            {ubicaciones.length}
          </span>
          <button
            onClick={() => { setMostrarForm((v) => !v); setError(""); }}
            className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl min-h-[48px] transition-colors"
          >
            <Plus size={16} /> Nueva
          </button>
        </div>

        <p className="text-sm text-gray-500">
          Cada ubicación es una posición física de la bodega. Se usan al guardar un activo
          y al responder dónde está algo.
        </p>

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-xl">{error}</p>
        )}

        {mostrarForm && (
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-400">Nueva ubicación</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input placeholder="Rack" value={nueva.rack}
                onChange={(e) => setNueva({ ...nueva, rack: e.target.value })} className={INPUT} />
              <input placeholder="Nivel" value={nueva.nivel}
                onChange={(e) => setNueva({ ...nueva, nivel: e.target.value })} className={INPUT} />
              <input placeholder="Posición" value={nueva.posicion}
                onChange={(e) => setNueva({ ...nueva, posicion: e.target.value })} className={INPUT} />
            </div>
            <input placeholder="Descripción (opcional — ej: Tornillería)" value={nueva.descripcion}
              onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })} className={INPUT} />
            <div className="flex gap-2">
              <button
                onClick={() => crear.mutate()}
                disabled={!nueva.rack.trim() || !nueva.nivel.trim() || !nueva.posicion.trim() || crear.isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl min-h-[48px] transition-colors"
              >
                {crear.isLoading ? "Creando..." : "Crear"}
              </button>
              <button onClick={() => { setMostrarForm(false); setError(""); }}
                className="px-4 text-sm text-gray-400 hover:bg-gray-700 rounded-xl min-h-[48px] transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-500 py-6">Cargando...</p>
        ) : ubicaciones.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-500">
            <MapPin size={36} className="text-gray-700" />
            <p className="text-sm">Todavía no hay ubicaciones</p>
            <p className="text-xs text-center max-w-xs">
              También se crean solas al importar activos por Excel o al guardar un activo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(porRack).map(([rack, items]) => {
              const abierto = racksAbiertos[rack] ?? true;
              return (
                <div key={rack} className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setRacksAbiertos((r) => ({ ...r, [rack]: !abierto }))}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-700/50 transition-colors min-h-[48px]"
                  >
                    <MapPin size={15} className="text-blue-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-white">Rack {rack}</span>
                    <span className="text-xs text-gray-500">{items.length} posiciones</span>
                    {abierto ? <ChevronUp size={15} className="ml-auto text-gray-500" />
                             : <ChevronDown size={15} className="ml-auto text-gray-500" />}
                  </button>

                  {abierto && (
                    <ul className="divide-y divide-gray-700/60 border-t border-gray-700">
                      {items.map((u) => (
                        <li key={u.id} className="px-4 py-2.5">
                          {editando?.id === u.id ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-3 gap-2">
                                <input value={editando.rack}
                                  onChange={(e) => setEditando({ ...editando, rack: e.target.value })} className={INPUT} />
                                <input value={editando.nivel}
                                  onChange={(e) => setEditando({ ...editando, nivel: e.target.value })} className={INPUT} />
                                <input value={editando.posicion}
                                  onChange={(e) => setEditando({ ...editando, posicion: e.target.value })} className={INPUT} />
                              </div>
                              <input placeholder="Descripción" value={editando.descripcion ?? ""}
                                onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })} className={INPUT} />
                              <div className="flex gap-2">
                                <button onClick={() => actualizar.mutate(editando)}
                                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-2 rounded-xl min-h-[44px] transition-colors">
                                  <Check size={14} /> Guardar
                                </button>
                                <button onClick={() => { setEditando(null); setError(""); }}
                                  className="px-3 py-2 text-xs text-gray-400 hover:bg-gray-700 rounded-xl min-h-[44px] transition-colors">
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">
                                  Nivel {u.nivel} · Pos {u.posicion}
                                </p>
                                {u.descripcion && (
                                  <p className="text-xs text-gray-500 truncate">{u.descripcion}</p>
                                )}
                              </div>
                              <button onClick={() => { setEditando(u); setError(""); }}
                                title="Editar"
                                className="p-2 text-gray-500 hover:text-blue-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                                <Pencil size={15} />
                              </button>
                              <button onClick={() => eliminar.mutate(u.id)}
                                title="Eliminar"
                                className="p-2 text-gray-500 hover:text-red-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TenantGuard>
  );
}
