import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { LayoutList, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { adminApi } from "../../services/api";

interface Module { id: number; nombre: string; icono: string | null; orden: number; }
const EMPTY = { nombre: "", icono: "", orden: 0 };

export function AdminModules() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);

  const { data: modules = [], isLoading } = useQuery<Module[]>("admin-modules", () =>
    adminApi.listModules().then((r) => r.data)
  );

  const createMutation = useMutation(
    () => adminApi.createModule({ ...form, icono: form.icono || null }),
    { onSuccess: () => { qc.invalidateQueries("admin-modules"); setShowForm(false); setForm(EMPTY); } }
  );

  const updateMutation = useMutation(
    ({ id, d }: { id: number; d: object }) => adminApi.updateModule(id, d),
    { onSuccess: () => { qc.invalidateQueries("admin-modules"); setEditId(null); } }
  );

  const deleteMutation = useMutation(
    (id: number) => adminApi.deleteModule(id),
    { onSuccess: () => qc.invalidateQueries("admin-modules") }
  );

  if (isLoading) return <p className="text-gray-400 p-4">Cargando módulos...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <LayoutList size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Módulos</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">{modules.length}</span>
        <button onClick={() => setShowForm((v) => !v)}
          className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl min-h-[44px] transition-colors">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Nuevo módulo</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input required placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input placeholder="Ícono Lucide (ej: Package)" value={form.icono} onChange={(e) => setForm({ ...form, icono: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input type="number" placeholder="Orden" value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]">
              {createMutation.isLoading ? "Guardando..." : "Crear módulo"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY); }}
              className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">Cancelar</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {modules.map((m) => (
          <div key={m.id} className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 flex items-center gap-3 min-w-0">
            <LayoutList size={16} className="text-blue-400 flex-shrink-0" />
            {editId === m.id ? (
              <>
                <input autoFocus value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  placeholder="Nombre" className="flex-1 bg-gray-700 border border-blue-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none" />
                <input value={editForm.icono} onChange={(e) => setEditForm({ ...editForm, icono: e.target.value })}
                  placeholder="Ícono" className="w-32 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none" />
                <input type="number" value={editForm.orden} onChange={(e) => setEditForm({ ...editForm, orden: Number(e.target.value) })}
                  className="w-16 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none" />
                <button onClick={() => updateMutation.mutate({ id: m.id, d: { nombre: editForm.nombre, icono: editForm.icono || null, orden: editForm.orden } })}
                  className="p-2 rounded-lg text-green-400 hover:bg-gray-700 transition-colors"><Check size={16} /></button>
                <button onClick={() => setEditId(null)}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 transition-colors"><X size={16} /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-white truncate">{m.nombre}</span>
                {m.icono && <span className="text-xs text-gray-500 font-mono">{m.icono}</span>}
                <span className="text-xs text-gray-600 w-8 text-right">#{m.orden}</span>
                <button onClick={() => { setEditId(m.id); setEditForm({ nombre: m.nombre, icono: m.icono ?? "", orden: m.orden }); }}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"><Pencil size={15} /></button>
                <button onClick={() => { if (confirm(`¿Eliminar módulo "${m.nombre}"?`)) deleteMutation.mutate(m.id); }}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
