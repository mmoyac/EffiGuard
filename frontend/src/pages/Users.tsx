import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { Users as UsersIcon, UserPlus, UserCheck, UserX, Shield, Pencil, RefreshCw, X, Printer, Wifi } from "lucide-react";
import { api } from "../services/api";
import { LabelPreviewModal } from "../components/LabelPreviewModal";
import { NFCScanner } from "../components/scanner/NFCScanner";

interface UserItem {
  id: number;
  rut: string;
  nombre: string;
  email: string;
  role_id: number;
  uid_credencial: string | null;
  is_active: boolean;
}

interface UserCreate {
  rut: string;
  nombre: string;
  email: string;
  password: string;
  role_id: number;
  uid_credencial?: string;
}

interface UserEdit {
  nombre: string;
  email: string;
  role_id: number;
  uid_credencial: string;
  password: string;
}

const ROLES: Record<number, { label: string; color: string }> = {
  2: { label: "Admin",     color: "text-purple-400 bg-purple-900/30 border-purple-800" },
  3: { label: "Bodeguero", color: "text-blue-400 bg-blue-900/30 border-blue-800" },
  4: { label: "Operario",  color: "text-green-400 bg-green-900/30 border-green-800" },
};

const EMPTY: UserCreate = { rut: "", nombre: "", email: "", password: "", role_id: 4 };

/** Genera un UID corto con prefijo, sin caracteres ambiguos (0/O, 1/I/L) */
function generateUid(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const code = Array.from(array).map((b) => chars[b % chars.length]).join("");
  return `${prefix}-${code}`;
}

export function Users() {
  const qc = useQueryClient();

  // --- preview impresión ---
  const [labelPreview, setLabelPreview] = useState<{ title: string; subtitle?: string; uid: string } | null>(null);

  // --- crear ---
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<UserCreate>(EMPTY);
  const [createError, setCreateError] = useState("");

  // --- NFC scanning ---
  const [nfcCreateOpen, setNfcCreateOpen] = useState(false);
  const [nfcEditOpen, setNfcEditOpen] = useState(false);

  // --- editar ---
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState<UserEdit>({ nombre: "", email: "", role_id: 4, uid_credencial: "", password: "" });
  const [editError, setEditError] = useState("");

  const { data: users = [], isLoading } = useQuery<UserItem[]>("users", () =>
    api.get("/users").then((r) => r.data)
  );

  const createMutation = useMutation(
    (data: UserCreate) => api.post("/users", data),
    {
      onSuccess: () => {
        qc.invalidateQueries("users");
        setShowForm(false);
        setForm(EMPTY);
        setCreateError("");
      },
      onError: (e: any) => setCreateError(e?.response?.data?.detail ?? "Error al crear usuario"),
    }
  );

  const updateMutation = useMutation(
    ({ id, data }: { id: number; data: Partial<UserEdit> }) =>
      api.patch(`/users/${id}`, data),
    {
      onSuccess: () => {
        qc.invalidateQueries("users");
        setEditUser(null);
        setEditError("");
      },
      onError: (e: any) => setEditError(e?.response?.data?.detail ?? "Error al actualizar usuario"),
    }
  );

  const toggleActive = useMutation(
    ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/users/${id}`, { is_active }),
    { onSuccess: () => qc.invalidateQueries("users") }
  );

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    createMutation.mutate(form);
  }

  function openEdit(u: UserItem) {
    setEditUser(u);
    setEditForm({
      nombre: u.nombre,
      email: u.email,
      role_id: u.role_id,
      uid_credencial: u.uid_credencial ?? "",
      password: "",
    });
    setEditError("");
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

  if (isLoading) return <p className="text-gray-400 p-4">Cargando usuarios...</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UsersIcon size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Usuarios</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
          {users.length} total
        </span>
        <button
          onClick={() => { setShowForm((v) => !v); setCreateError(""); }}
          className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl min-h-[44px] transition-colors"
        >
          <UserPlus size={16} />
          Nuevo
        </button>
      </div>

      {/* Formulario nuevo usuario */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Nuevo usuario</p>
          {createError && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{createError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required placeholder="Nombre completo" value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input required placeholder="RUT (ej: 12345678-9)" value={form.rut}
              onChange={(e) => setForm({ ...form, rut: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input required type="email" placeholder="Email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input required type="password" placeholder="Contraseña" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full">
              <option value={2}>Admin</option>
              <option value={3}>Bodeguero</option>
              <option value={4}>Operario</option>
            </select>

            {/* Credencial con botón Generar y NFC */}
            <div className="sm:col-span-2 space-y-1.5">
              <div className="flex gap-2">
                <input
                  placeholder="Credencial RFID/QR o tarjeta Bip! (opcional)"
                  value={form.uid_credencial ?? ""}
                  onChange={(e) => setForm({ ...form, uid_credencial: e.target.value || undefined })}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 flex-1 font-mono"
                />
                <button
                  type="button"
                  title="Escanear tarjeta Bip! u otra tarjeta NFC"
                  onClick={() => setNfcCreateOpen((v) => !v)}
                  className={`px-3 rounded-xl border transition-colors flex items-center min-h-[44px] ${nfcCreateOpen ? "bg-green-600 border-green-500 text-white" : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white"}`}
                >
                  <Wifi size={15} />
                </button>
                <button
                  type="button"
                  title="Generar credencial automática"
                  onClick={() => { setForm({ ...form, uid_credencial: generateUid("USR") }); setNfcCreateOpen(false); }}
                  className="px-3 rounded-xl border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors flex items-center min-h-[44px]"
                >
                  <RefreshCw size={15} />
                </button>
              </div>
              {nfcCreateOpen && (
                <NFCScanner
                  active={nfcCreateOpen}
                  onScan={(uid) => { setForm((f) => ({ ...f, uid_credencial: uid })); setNfcCreateOpen(false); }}
                />
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            La credencial puede ser la tarjeta Bip!, un tag NFC, o un QR generado automáticamente.
          </p>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={createMutation.isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]">
              {createMutation.isLoading ? "Guardando..." : "Crear usuario"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setCreateError(""); setForm(EMPTY); }}
              className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-2xl py-16 gap-3 text-gray-500">
          <UsersIcon size={40} className="text-gray-700" />
          <p className="text-sm font-medium">Sin usuarios registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const role = ROLES[u.role_id] ?? { label: `Rol ${u.role_id}`, color: "text-gray-400 bg-gray-800 border-gray-700" };
            return (
              <div key={u.id} className={`bg-gray-800 rounded-xl border px-4 py-3 flex items-center gap-3 min-w-0 ${u.is_active ? "border-gray-700" : "border-gray-700/40 opacity-60"}`}>
                <div className="w-9 h-9 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield size={16} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{u.nombre}</p>
                  <p className="text-xs text-gray-500 truncate">{u.rut} · {u.email}</p>
                  {u.uid_credencial && (
                    <p className="text-xs font-mono text-gray-500 truncate">{u.uid_credencial}</p>
                  )}
                </div>
                <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${role.color}`}>
                  {role.label}
                </span>
                {u.uid_credencial && (
                  <button
                    onClick={() => setLabelPreview({ title: u.nombre, subtitle: role.label, uid: u.uid_credencial! })}
                    title="Imprimir credencial"
                    className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    <Printer size={15} />
                  </button>
                )}
                <button
                  onClick={() => openEdit(u)}
                  title="Editar usuario"
                  className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                  title={u.is_active ? "Desactivar" : "Activar"}
                  className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  {u.is_active ? <UserCheck size={16} className="text-green-400" /> : <UserX size={16} className="text-red-400" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal editar usuario */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleEdit}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-5 w-full max-w-md space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Editar usuario</p>
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
                <option value={2}>Admin</option>
                <option value={3}>Bodeguero</option>
                <option value={4}>Operario</option>
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
                    title="Escanear tarjeta Bip! u otra tarjeta NFC"
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
                  onClick={() => setLabelPreview({ title: editForm.nombre, subtitle: ROLES[editForm.role_id]?.label, uid: editForm.uid_credencial })}
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
