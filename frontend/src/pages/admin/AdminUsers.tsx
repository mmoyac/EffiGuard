import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { UsersRound, UserPlus, UserCheck, UserX, Pencil, RefreshCw, X, Printer, Wifi } from "lucide-react";
import { adminApi } from "../../services/api";
import { useTenantStore } from "../../stores/tenantStore";
import { LabelPreviewModal } from "../../components/LabelPreviewModal";
import { NFCScanner } from "../../components/scanner/NFCScanner";

interface Tenant { id: number; nombre_empresa: string; }
interface Role { id: number; nombre: string; }
interface GlobalUser {
  id: number; tenant_id: number; role_id: number;
  rut: string; nombre: string; email: string;
  uid_credencial: string | null; is_active: boolean;
}

interface UserEdit {
  nombre: string;
  email: string;
  role_id: number;
  uid_credencial: string;
  password: string;
}

const EMPTY = { tenant_id: 0, rut: "", nombre: "", email: "", password: "", role_id: 4, uid_credencial: "" };

function generateUid(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const code = Array.from(array).map((b) => chars[b % chars.length]).join("");
  return `${prefix}-${code}`;
}

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

  // --- editar ---
  const [editUser, setEditUser] = useState<GlobalUser | null>(null);
  const [editForm, setEditForm] = useState<UserEdit>({ nombre: "", email: "", role_id: 4, uid_credencial: "", password: "" });
  const [editError, setEditError] = useState("");
  const [nfcEditOpen, setNfcEditOpen] = useState(false);

  // --- imprimir ---
  const [labelPreview, setLabelPreview] = useState<{ title: string; subtitle?: string; uid: string } | null>(null);

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

  const updateMutation = useMutation(
    ({ id, data }: { id: number; data: Partial<UserEdit> }) => adminApi.updateUser(id, data),
    {
      onSuccess: () => { qc.invalidateQueries("admin-users"); setEditUser(null); setEditError(""); },
      onError: (e: any) => setEditError(e?.response?.data?.detail ?? "Error al actualizar usuario"),
    }
  );

  const toggleActive = useMutation(
    ({ id, is_active }: { id: number; is_active: boolean }) => adminApi.updateUser(id, { is_active }),
    { onSuccess: () => qc.invalidateQueries("admin-users") }
  );

  function openEdit(u: GlobalUser) {
    setEditUser(u);
    setEditForm({ nombre: u.nombre, email: u.email, role_id: u.role_id, uid_credencial: u.uid_credencial ?? "", password: "" });
    setEditError("");
    setNfcEditOpen(false);
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditError("");
    const payload: Partial<UserEdit> = {
      nombre: editForm.nombre,
      email: editForm.email,
      role_id: editForm.role_id,
      uid_credencial: editForm.uid_credencial || undefined,
    };
    if (editForm.password) payload.password = editForm.password;
    updateMutation.mutate({ id: editUser.id, data: payload });
  }

  const tenantName = (id: number) => tenants.find((t) => t.id === id)?.nombre_empresa ?? `Tenant #${id}`;
  const roleName = (id: number) => roles.find((r) => r.id === id)?.nombre ?? `Rol ${id}`;

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
          <div key={u.id} className={`bg-gray-800 rounded-xl border px-4 py-3 ${u.is_active ? "border-gray-700" : "border-gray-700/40 opacity-60"}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{u.nombre}</p>
                <p className="text-xs text-gray-500 truncate">{u.email} · {u.rut}</p>
                <p className="text-xs text-blue-400 truncate">{tenantName(u.tenant_id)}</p>
                {u.uid_credencial && (
                  <p className="text-xs font-mono text-gray-500 truncate">{u.uid_credencial}</p>
                )}
              </div>
              <span className="flex-shrink-0 text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">
                {roleName(u.role_id)}
              </span>
              {u.uid_credencial && (
                <button
                  onClick={() => setLabelPreview({ title: u.nombre, subtitle: roleName(u.role_id), uid: u.uid_credencial! })}
                  title="Imprimir credencial"
                  className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  <Printer size={15} />
                </button>
              )}
              <button
                onClick={() => openEdit(u)}
                className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-700 transition-colors"
                title="Editar usuario"
              >
                <Pencil size={15} />
              </button>
              <button onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-700 transition-colors">
                {u.is_active ? <UserCheck size={16} className="text-green-400" /> : <UserX size={16} className="text-red-400" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal editar usuario */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleEdit}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-5 w-full max-w-md space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Editar usuario</p>
                <p className="text-xs text-blue-400">{tenantName(editUser.tenant_id)}</p>
              </div>
              <button type="button" onClick={() => setEditUser(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {editError && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{editError}</p>
            )}

            <div className="space-y-3">
              <input required placeholder="Nombre completo" value={editForm.nombre}
                onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />

              <input required type="email" placeholder="Email" value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />

              <select value={editForm.role_id}
                onChange={(e) => setEditForm({ ...editForm, role_id: Number(e.target.value) })}
                className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full">
                {roles.filter((r) => r.id !== 1).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>

              {/* Credencial con NFC, Generar y limpiar */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Credencial — tarjeta Bip!, NFC o QR</label>
                <div className="flex gap-2">
                  <input
                    placeholder="Escanea tarjeta o genera código"
                    value={editForm.uid_credencial}
                    onChange={(e) => setEditForm({ ...editForm, uid_credencial: e.target.value })}
                    className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 flex-1 font-mono"
                  />
                  <button
                    type="button"
                    title="Escanear tarjeta NFC"
                    onClick={() => setNfcEditOpen((v) => !v)}
                    className={`px-3 rounded-xl border transition-colors flex items-center min-h-[44px] ${nfcEditOpen ? "bg-green-600 border-green-500 text-white" : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white"}`}
                  >
                    <Wifi size={15} />
                  </button>
                  <button
                    type="button"
                    title="Generar nueva credencial"
                    onClick={() => { setEditForm({ ...editForm, uid_credencial: generateUid("USR") }); setNfcEditOpen(false); }}
                    className="px-3 rounded-xl border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors flex items-center min-h-[44px]"
                  >
                    <RefreshCw size={15} />
                  </button>
                  {editForm.uid_credencial && (
                    <button
                      type="button"
                      title="Quitar credencial"
                      onClick={() => { setEditForm({ ...editForm, uid_credencial: "" }); setNfcEditOpen(false); }}
                      className="px-3 rounded-xl border border-gray-600 bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-red-400 transition-colors flex items-center min-h-[44px]"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                {nfcEditOpen && (
                  <NFCScanner
                    active={nfcEditOpen}
                    onScan={(uid) => { setEditForm((f) => ({ ...f, uid_credencial: uid })); setNfcEditOpen(false); }}
                  />
                )}
              </div>

              {/* Contraseña opcional */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-400">
                  Nueva contraseña <span className="text-gray-500 font-normal">(dejar vacío para no cambiar)</span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={updateMutation.isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]">
                {updateMutation.isLoading ? "Guardando..." : "Guardar cambios"}
              </button>
              {editForm.uid_credencial && (
                <button
                  type="button"
                  title="Imprimir credencial"
                  onClick={() => setLabelPreview({ title: editForm.nombre, subtitle: roleName(editForm.role_id), uid: editForm.uid_credencial })}
                  className="px-3 py-2.5 rounded-xl border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors flex items-center min-h-[44px]"
                >
                  <Printer size={16} />
                </button>
              )}
              <button type="button" onClick={() => setEditUser(null)}
                className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {labelPreview && (
        <LabelPreviewModal
          title={labelPreview.title}
          subtitle={labelPreview.subtitle}
          uid={labelPreview.uid}
          onClose={() => setLabelPreview(null)}
        />
      )}
    </div>
  );
}
