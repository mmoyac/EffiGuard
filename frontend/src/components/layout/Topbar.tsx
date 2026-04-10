import * as Icons from "lucide-react";
import { useQuery } from "react-query";
import { useAuthStore } from "../../stores/authStore";
import { useTenantStore } from "../../stores/tenantStore";
import { adminApi } from "../../services/api";

interface Tenant { id: number; nombre_empresa: string; slug: string; }

const ROLE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Super Admin", color: "text-red-400 bg-red-900/30" },
  2: { label: "Admin",       color: "text-purple-400 bg-purple-900/30" },
  3: { label: "Bodeguero",   color: "text-blue-400 bg-blue-900/30" },
  4: { label: "Operario",    color: "text-green-400 bg-green-900/30" },
};

interface TopbarProps {
  onMobileMenuOpen: () => void;
}

export function Topbar({ onMobileMenuOpen }: TopbarProps) {
  const { user, logout } = useAuthStore((s) => ({ user: s.user, logout: s.logout }));
  const { actingTenantId, actingTenantName, setActingTenant, clearActingTenant } = useTenantStore();
  const isSuperAdmin = user?.role_id === 1;

  const { data: tenants = [] } = useQuery<Tenant[]>(
    "admin-tenants",
    () => adminApi.listTenants().then((r) => r.data),
    { enabled: isSuperAdmin }
  );

  const role = user
    ? (ROLE_LABELS[user.role_id] ?? { label: "Rol desconocido", color: "text-gray-400 bg-gray-800" })
    : null;

  return (
    <header className="flex items-center gap-3 px-4 border-b border-gray-800 flex-shrink-0 min-h-[60px] bg-gray-950">
      {/* Hamburger + logo (móvil) */}
      <button
        onClick={onMobileMenuOpen}
        className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        aria-label="Abrir menú"
      >
        <Icons.Menu size={22} />
      </button>
      <span className="md:hidden text-base font-bold text-blue-400">EffiGuard</span>

      <div className="flex-1" />

      {/* Tenant selector (solo super admin) */}
      {isSuperAdmin && (
        <div className="flex items-center gap-2">
          <Icons.Building2
            size={15}
            className={actingTenantId ? "text-yellow-400" : "text-gray-500"}
          />
          <select
            value={actingTenantId ?? ""}
            onChange={(e) => {
              if (!e.target.value) { clearActingTenant(); return; }
              const t = tenants.find((t) => t.id === Number(e.target.value));
              if (t) setActingTenant(t.id, t.nombre_empresa);
            }}
            title={actingTenantId ? `Operando en: ${actingTenantName}` : "Operar como tenant"}
            className={`bg-gray-800 border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 max-w-[180px]
              ${actingTenantId ? "border-yellow-700 text-yellow-300" : "border-gray-600"}`}
          >
            <option value="">— Propio (Super Admin) —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre_empresa}</option>
            ))}
          </select>
        </div>
      )}

      {isSuperAdmin && <div className="w-px h-5 bg-gray-700" />}

      {/* Usuario */}
      {user && role && (
        <div className="flex items-center gap-2">
          <Icons.UserCircle size={18} className="text-gray-400 flex-shrink-0" />
          <span className="hidden sm:block text-sm font-medium text-white truncate max-w-[120px]">
            {user.nombre}
          </span>
          <span className={`hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${role.color}`}>
            {role.label}
          </span>
        </div>
      )}

      {/* Campanita (placeholder futuro) */}
      <button
        disabled
        title="Notificaciones (próximamente)"
        className="p-2 rounded-lg text-gray-600 cursor-not-allowed"
      >
        <Icons.Bell size={18} />
      </button>

      <div className="w-px h-5 bg-gray-700" />

      {/* Cerrar sesión */}
      <button
        onClick={() => { clearActingTenant(); logout(); }}
        title="Cerrar sesión"
        className="p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
      >
        <Icons.LogOut size={18} />
      </button>
    </header>
  );
}
