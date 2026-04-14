import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { FolderOpen, FolderPlus, FolderX } from "lucide-react";
import { api } from "../services/api";

interface Project {
  id: number;
  nombre: string;
  is_active: boolean;
}

export function Projects() {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const { data: projects = [], isLoading } = useQuery<Project[]>("projects", () =>
    api.get("/projects").then((r) => r.data)
  );

  const createMutation = useMutation(
    (nombre: string) => api.post("/projects", { nombre }),
    {
      onSuccess: () => {
        qc.invalidateQueries("projects");
        setNombre("");
        setShowForm(false);
        setError("");
      },
      onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al crear proyecto"),
    }
  );

  const deactivateMutation = useMutation(
    (id: number) => api.patch(`/projects/${id}/deactivate`),
    { onSuccess: () => qc.invalidateQueries("projects") }
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setError("");
    createMutation.mutate(nombre.trim());
  }

  const active = projects.filter((p) => p.is_active);
  const inactive = projects.filter((p) => !p.is_active);

  if (isLoading) return <p className="text-gray-400 p-4">Cargando proyectos...</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FolderOpen size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Proyectos</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
          {active.length} activo{active.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => { setShowForm((v) => !v); setError(""); }}
          className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl min-h-[44px] transition-colors"
        >
          <FolderPlus size={16} />
          Nuevo
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Nuevo proyecto</p>
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{error}</p>}
          <input
            required
            placeholder="Nombre del proyecto"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]">
              {createMutation.isLoading ? "Guardando..." : "Crear proyecto"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setNombre(""); setError(""); }}
              className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Proyectos activos */}
      {active.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-2xl py-16 gap-3 text-gray-500">
          <FolderOpen size={40} className="text-gray-700" />
          <p className="text-sm font-medium">Sin proyectos activos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((p) => (
            <div key={p.id} className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 flex items-center gap-3 min-w-0">
              <FolderOpen size={18} className="text-blue-400 flex-shrink-0" />
              <span className="flex-1 text-sm font-medium text-white truncate">{p.nombre}</span>
              <span className="flex-shrink-0 text-xs text-green-400 bg-green-900/30 border border-green-800 px-2.5 py-1 rounded-full font-semibold">
                Activo
              </span>
              <button
                onClick={() => deactivateMutation.mutate(p.id)}
                title="Desactivar proyecto"
                className="flex-shrink-0 p-2 rounded-lg text-gray-500 hover:bg-gray-700 hover:text-red-400 transition-colors"
              >
                <FolderX size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Proyectos inactivos */}
      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium px-1">Inactivos</p>
          {inactive.map((p) => (
            <div key={p.id} className="bg-gray-800/50 rounded-xl border border-gray-700/40 px-4 py-3 flex items-center gap-3 min-w-0 opacity-60">
              <FolderOpen size={18} className="text-gray-600 flex-shrink-0" />
              <span className="flex-1 text-sm text-gray-500 truncate">{p.nombre}</span>
              <span className="flex-shrink-0 text-xs text-gray-500 bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-full">
                Inactivo
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
