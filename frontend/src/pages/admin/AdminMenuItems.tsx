import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { Menu, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { adminApi } from "../../services/api";

interface Module { id: number; nombre: string; }
interface MenuItemRow {
  id: number; module_id: number; parent_id: number | null;
  label: string; ruta: string; icono: string | null; orden: number;
}

const EMPTY = { module_id: 0, parent_id: "", label: "", ruta: "", icono: "", orden: 0 };

export function AdminMenuItems() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);

  const { data: modules = [] } = useQuery<Module[]>("admin-modules", () =>
    adminApi.listModules().then((r) => r.data)
  );
  const { data: items = [], isLoading } = useQuery<MenuItemRow[]>("admin-menu-items", () =>
    adminApi.listMenuItems().then((r) => r.data)
  );

  const toPayload = (f: typeof EMPTY) => ({
    module_id: Number(f.module_id),
    parent_id: f.parent_id ? Number(f.parent_id) : null,
    label: f.label,
    ruta: f.ruta,
    icono: f.icono || null,
    orden: Number(f.orden),
  });

  const createMutation = useMutation(
    () => adminApi.createMenuItem(toPayload(form)),
    { onSuccess: () => { qc.invalidateQueries("admin-menu-items"); setShowForm(false); setForm(EMPTY); } }
  );

  const updateMutation = useMutation(
    ({ id, d }: { id: number; d: object }) => adminApi.updateMenuItem(id, d),
    { onSuccess: () => { qc.invalidateQueries("admin-menu-items"); setEditId(null); } }
  );

  const deleteMutation = useMutation(
    (id: number) => adminApi.deleteMenuItem(id),
    { onSuccess: () => qc.invalidateQueries("admin-menu-items") }
  );

  const moduleName = (id: number) => modules.find((m) => m.id === id)?.nombre ?? `#${id}`;

  if (isLoading) return <p className="text-gray-400 p-4">Cargando ítems...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Menu size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Ítems de Menú</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">{items.length}</span>
        <button onClick={() => setShowForm((v) => !v)}
          className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl min-h-[44px] transition-colors">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Nuevo ítem de menú</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select required value={form.module_id || ""} onChange={(e) => setForm({ ...form, module_id: Number(e.target.value) })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full">
              <option value="">Módulo</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
            <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full">
              <option value="">Sin padre (raíz)</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
            <input required placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input required placeholder="Ruta (ej: /assets)" value={form.ruta} onChange={(e) => setForm({ ...form, ruta: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input placeholder="Ícono Lucide" value={form.icono} onChange={(e) => setForm({ ...form, icono: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input type="number" placeholder="Orden" value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]">
              {createMutation.isLoading ? "Guardando..." : "Crear ítem"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY); }}
              className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">Cancelar</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 flex items-center gap-3 min-w-0">
            {editId === item.id ? (
              <>
                <input autoFocus value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                  placeholder="Label" className="w-28 bg-gray-700 border border-blue-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none" />
                <input value={editForm.ruta} onChange={(e) => setEditForm({ ...editForm, ruta: e.target.value })}
                  placeholder="Ruta" className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none" />
                <input value={editForm.icono} onChange={(e) => setEditForm({ ...editForm, icono: e.target.value })}
                  placeholder="Ícono" className="w-28 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none" />
                <input type="number" value={editForm.orden} onChange={(e) => setEditForm({ ...editForm, orden: Number(e.target.value) })}
                  className="w-14 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none" />
                <button onClick={() => updateMutation.mutate({ id: item.id, d: toPayload(editForm) })}
                  className="p-2 rounded-lg text-green-400 hover:bg-gray-700 transition-colors"><Check size={16} /></button>
                <button onClick={() => setEditId(null)}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 transition-colors"><X size={16} /></button>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.label}</p>
                  <p className="text-xs text-gray-500 font-mono truncate">{item.ruta} · {moduleName(item.module_id)}</p>
                </div>
                {item.icono && <span className="text-xs text-gray-500 font-mono flex-shrink-0 hidden sm:block">{item.icono}</span>}
                <span className="text-xs text-gray-600 flex-shrink-0">#{item.orden}</span>
                <button onClick={() => { setEditId(item.id); setEditForm({ module_id: item.module_id, parent_id: item.parent_id?.toString() ?? "", label: item.label, ruta: item.ruta, icono: item.icono ?? "", orden: item.orden }); }}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors flex-shrink-0"><Pencil size={15} /></button>
                <button onClick={() => { if (confirm(`¿Eliminar "${item.label}"?`)) deleteMutation.mutate(item.id); }}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-red-400 transition-colors flex-shrink-0"><Trash2 size={15} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
