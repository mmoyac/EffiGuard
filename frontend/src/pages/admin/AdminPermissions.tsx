import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { KeyRound, Save } from "lucide-react";
import { adminApi } from "../../services/api";

interface Role { id: number; nombre: string; }
interface MenuItemRow {
  id: number; label: string; ruta: string;
  module_id: number; parent_id: number | null; orden: number;
}
interface Module { id: number; nombre: string; }
interface Permission { id: number; role_id: number; menu_item_id: number; }

export function AdminPermissions() {
  const qc = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState(false);

  const { data: roles = [] } = useQuery<Role[]>("admin-roles", () =>
    adminApi.listRoles().then((r) => r.data)
  );
  const { data: modules = [] } = useQuery<Module[]>("admin-modules", () =>
    adminApi.listModules().then((r) => r.data)
  );
  const { data: items = [] } = useQuery<MenuItemRow[]>("admin-menu-items", () =>
    adminApi.listMenuItems().then((r) => r.data)
  );
  const { data: permissions = [], isLoading: loadingPerms } = useQuery<Permission[]>(
    ["admin-permissions", selectedRole],
    () => adminApi.listPermissions(selectedRole!).then((r) => r.data),
    { enabled: selectedRole !== null }
  );

  useEffect(() => {
    if (permissions.length > 0 || selectedRole !== null) {
      setChecked(new Set(permissions.map((p) => p.menu_item_id)));
      setSaved(false);
    }
  }, [permissions, selectedRole]);

  const saveMutation = useMutation(
    () => adminApi.setPermissions(selectedRole!, Array.from(checked)),
    {
      onSuccess: () => {
        qc.invalidateQueries(["admin-permissions", selectedRole]);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    }
  );

  const toggle = (id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSaved(false);
  };

  // Agrupar ítems por módulo
  const byModule = modules.map((mod) => ({
    module: mod,
    items: items.filter((i) => i.module_id === mod.id).sort((a, b) => a.orden - b.orden),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <KeyRound size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Permisos de Menú</h2>
      </div>

      <p className="text-sm text-gray-400">
        Selecciona un rol y marca los ítems de menú que puede ver.
        Los cambios se guardan al presionar "Guardar".
      </p>

      {/* Selector de rol */}
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button key={r.id} onClick={() => setSelectedRole(r.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
              selectedRole === r.id
                ? "bg-blue-600 text-white"
                : "bg-gray-800 border border-gray-700 text-gray-300 hover:border-blue-500 hover:text-white"
            }`}>
            {r.nombre}
          </button>
        ))}
      </div>

      {selectedRole === null ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-2xl py-16 gap-3 text-gray-500">
          <KeyRound size={40} className="text-gray-700" />
          <p className="text-sm font-medium">Selecciona un rol para editar sus permisos</p>
        </div>
      ) : loadingPerms ? (
        <p className="text-gray-400 text-sm">Cargando permisos...</p>
      ) : (
        <>
          <div className="space-y-3">
            {byModule.map(({ module, items: modItems }) => (
              <div key={module.id} className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-700/50 border-b border-gray-700">
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{module.nombre}</p>
                </div>
                <div className="divide-y divide-gray-700/50">
                  {modItems.map((item) => (
                    <label key={item.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-700/30 transition-colors">
                      <input type="checkbox" checked={checked.has(item.id)} onChange={() => toggle(item.id)}
                        className="w-4 h-4 rounded accent-blue-500 cursor-pointer" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-gray-500 font-mono">{item.ruta}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading}
            className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl text-sm transition-colors min-h-[48px] ${
              saved
                ? "bg-green-700 text-white"
                : "bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white"
            }`}>
            <Save size={16} />
            {saveMutation.isLoading ? "Guardando..." : saved ? "¡Guardado!" : "Guardar permisos"}
          </button>
        </>
      )}
    </div>
  );
}
