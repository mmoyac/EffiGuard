import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { Tag, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { adminApi } from "../../services/api";

interface AssetState { id: number; nombre: string; }

export function AdminAssetStates() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const { data: states = [], isLoading } = useQuery<AssetState[]>("admin-asset-states", () =>
    adminApi.listAssetStates().then((r) => r.data)
  );

  const createMutation = useMutation(
    () => adminApi.createAssetState({ nombre: newName.trim() }),
    { onSuccess: () => { qc.invalidateQueries("admin-asset-states"); setNewName(""); setShowForm(false); } }
  );

  const updateMutation = useMutation(
    ({ id, nombre }: { id: number; nombre: string }) => adminApi.updateAssetState(id, { nombre }),
    { onSuccess: () => { qc.invalidateQueries("admin-asset-states"); setEditId(null); } }
  );

  const deleteMutation = useMutation(
    (id: number) => adminApi.deleteAssetState(id),
    { onSuccess: () => qc.invalidateQueries("admin-asset-states") }
  );

  if (isLoading) return <p className="text-gray-400 p-4">Cargando estados...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Tag size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Estados de Activo</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">{states.length}</span>
        <button onClick={() => setShowForm((v) => !v)}
          className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl min-h-[44px] transition-colors">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate(); }}
          className="flex gap-2">
          <input autoFocus required placeholder="Nombre del estado" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <button type="submit" disabled={createMutation.isLoading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-colors">
            Crear
          </button>
          <button type="button" onClick={() => { setShowForm(false); setNewName(""); }}
            className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">
            Cancelar
          </button>
        </form>
      )}

      <div className="space-y-2">
        {states.map((s) => (
          <div key={s.id} className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 flex items-center gap-3 min-w-0">
            <Tag size={16} className="text-blue-400 flex-shrink-0" />
            {editId === s.id ? (
              <>
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 bg-gray-700 border border-blue-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none" />
                <button onClick={() => updateMutation.mutate({ id: s.id, nombre: editName })}
                  className="p-2 rounded-lg text-green-400 hover:bg-gray-700 transition-colors"><Check size={16} /></button>
                <button onClick={() => setEditId(null)}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 transition-colors"><X size={16} /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-white">{s.nombre}</span>
                <span className="text-xs text-gray-500">#{s.id}</span>
                <button onClick={() => { setEditId(s.id); setEditName(s.nombre); }}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"><Pencil size={15} /></button>
                <button onClick={() => { if (confirm(`¿Eliminar estado "${s.nombre}"?`)) deleteMutation.mutate(s.id); }}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
