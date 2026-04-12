import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { UsersRound, UserPlus, UserCheck, UserX, Pencil, Check, X } from "lucide-react";
import { adminApi } from "../../services/api";
import { useTenantStore } from "../../stores/tenantStore";

interface Tenant { id: number; nombre_empresa: string; }
interface Role { id: number; nombre: string; }
interface GlobalUser {
  id: number; tenant_id: number; role_id: number;
  rut: string; nombre: string; email: string;
  uid_credencial: string | null; is_active: boolean;
}

const EMPTY = { tenant_id: 0, rut: "", nombre: "", email: "", password: "", role_id: 4, uid_credencial: "" };

export function AdminUsers() {
  const qc = useQueryClient();
  const { actingTenantId } = useTenantStore();
  const [tenantFilter, setTenantFilter] = useState<number | undefined>(actingTenantId ?? undefined);

  useEffect(() => {
    setTenantFilter(actingTenantId ?? undefined);
  }, [actingTenantId]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  const { data: tenants = [] } = useQuery<Tenant[]>("admin-tenants", () =>
    adminApi.listTenants().then((r) => r.data)
  );
  const { data: roles = [] } = useQuery<Role[]>("admin-roles", () =>
    adminApi.listRoles().then((r) => r.data)
  );
  const { data: users = [], isLoading } = useQuery<GlobalUser[]>(
    ["admin-users", tenantFilter],
    () => adminApi.listUsers(tenantFilter).then((r) => r.data)
  );

  const createMutation = useMutation(
    (d: typeof EMPTY) => adminApi.createUser({ ...d, uid_credencial: d.uid_credencial || undefined }),
    {
      onSuccess: () => { qc.invalidateQueries("admin-users"); setShowForm(false); setForm(EMPTY); setError(""); },
      onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al crear"),
    }
  );

  const toggleActive = useMutation(
    ({ id, is_active }: { id: number; is_active: boolean }) => adminApi.updateUser(id, { is_active }),
    { onSuccess: () => qc.invalidateQueries("admin-users") }
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editUid, setEditUid] = useState("");

  const updateUid = useMutation(
    ({ id, uid }: { id: number; uid: string }) =>
      adminApi.updateUser(id, { uid_credencial: uid || null }),
    {
      onSuccess: () => { qc.invalidateQueries("admin-users"); setEditingId(null); },
    }
  );

  const tenantName = (id: number) => tenants.find((t) => t.id === id)?.nombre_empresa ?? `Tenant #${id}`;

  if (isLoading) return <p className="text-gray-400 p-4">Cargando usuarios...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <UsersRound size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Usuarios Global</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">{users.length}</span>
        <button onClick={() => { setShowForm((v) => !v); setError(""); }}
          className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl min-h-[44px] transition-colors">
          <UserPlus size={16} /> Nuevo
        </button>
      </div>

      {/* Filtro tenant */}
      <select value={tenantFilter ?? ""} onChange={(e) => setTenantFilter(e.target.value ? Number(e.target.value) : undefined)}
        className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full sm:w-64">
        <option value="">Todos los tenants</option>
        {tenants.map((t) => <option key={t.id} value={t.id}>{t.nombre_empresa}</option>)}
      </select>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
          className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Nuevo usuario</p>
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select required value={form.tenant_id || ""} onChange={(e) => setForm({ ...form, tenant_id: Number(e.target.value) })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full">
              <option value="">Seleccionar tenant</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.nombre_empresa}</option>)}
            </select>
            <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full">
              {roles.filter((r) => r.id !== 1).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
            <input required placeholder="Nombre completo" value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input required placeholder="RUT" value={form.rut}
              onChange={(e) => setForm({ ...form, rut: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input required type="email" placeholder="Email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input required type="password" placeholder="Contraseña" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input placeholder="UID credencial (opcional)" value={form.uid_credencial}
              onChange={(e) => setForm({ ...form, uid_credencial: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full sm:col-span-2" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]">
              {createMutation.isLoading ? "Guardando..." : "Crear usuario"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(""); setForm(EMPTY); }}
              className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">Cancelar</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className={`bg-gray-800 rounded-xl border px-4 py-3 space-y-2 ${u.is_active ? "border-gray-700" : "border-gray-700/40 opacity-60"}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{u.nombre}</p>
                <p className="text-xs text-gray-500 truncate">{u.email} · {u.rut}</p>
                <p className="text-xs text-blue-400 truncate">{tenantName(u.tenant_id)}</p>
              </div>
              <span className="flex-shrink-0 text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">
                {roles.find((r) => r.id === u.role_id)?.nombre ?? `rol ${u.role_id}`}
              </span>
              <button
                onClick={() => { setEditingId(editingId === u.id ? null : u.id); setEditUid(u.uid_credencial ?? ""); }}
                className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-700 transition-colors"
                title="Editar credencial"
              >
                <Pencil size={15} />
              </button>
              <button onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-700 transition-colors">
                {u.is_active ? <UserCheck size={16} className="text-green-400" /> : <UserX size={16} className="text-red-400" />}
              </button>
            </div>

            {editingId === u.id && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  autoFocus
                  type="text"
                  value={editUid}
                  onChange={(e) => setEditUid(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateUid.mutate({ id: u.id, uid: editUid });
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  placeholder="UID credencial RFID/QR (vacío para quitar)"
                  className="flex-1 bg-gray-700 border border-gray-600 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none font-mono"
                />
                <button
                  onClick={() => updateUid.mutate({ id: u.id, uid: editUid })}
                  disabled={updateUid.isLoading}
                  className="p-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg transition-colors"
                  title="Guardar"
                >
                  <Check size={15} className="text-white" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  title="Cancelar"
                >
                  <X size={15} className="text-gray-300" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
