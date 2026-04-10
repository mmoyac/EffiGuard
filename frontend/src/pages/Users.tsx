import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { Users as UsersIcon, UserPlus, UserCheck, UserX, Shield } from "lucide-react";
import { api } from "../services/api";

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

const ROLES: Record<number, { label: string; color: string }> = {
  2: { label: "Admin",     color: "text-purple-400 bg-purple-900/30 border-purple-800" },
  3: { label: "Bodeguero", color: "text-blue-400 bg-blue-900/30 border-blue-800" },
  4: { label: "Operario",  color: "text-green-400 bg-green-900/30 border-green-800" },
};

const EMPTY: UserCreate = { rut: "", nombre: "", email: "", password: "", role_id: 4 };

export function Users() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<UserCreate>(EMPTY);
  const [error, setError] = useState("");

  const { data: users = [], isLoading } = useQuery<UserItem[]>("users", () =>
    api.get("/users/").then((r) => r.data)
  );

  const createMutation = useMutation(
    (data: UserCreate) => api.post("/users/", data),
    {
      onSuccess: () => {
        qc.invalidateQueries("users");
        setShowForm(false);
        setForm(EMPTY);
        setError("");
      },
      onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al crear usuario"),
    }
  );

  const toggleActive = useMutation(
    ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/users/${id}`, { is_active }),
    { onSuccess: () => qc.invalidateQueries("users") }
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    createMutation.mutate(form);
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
          onClick={() => { setShowForm((v) => !v); setError(""); }}
          className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl min-h-[44px] transition-colors"
        >
          <UserPlus size={16} />
          Nuevo
        </button>
      </div>

      {/* Formulario nuevo usuario */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Nuevo usuario</p>
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{error}</p>}
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
            <input placeholder="UID credencial (RFID/QR, opcional)" value={form.uid_credencial ?? ""}
              onChange={(e) => setForm({ ...form, uid_credencial: e.target.value || undefined })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={createMutation.isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]">
              {createMutation.isLoading ? "Guardando..." : "Crear usuario"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(""); setForm(EMPTY); }}
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
                </div>
                <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${role.color}`}>
                  {role.label}
                </span>
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
    </div>
  );
}
