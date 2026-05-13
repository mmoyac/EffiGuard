import { Building2 } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useTenantStore } from "../../stores/tenantStore";

export function TenantGuard({ children }: { children: React.ReactNode }) {
  const roleId = useAuthStore((s) => s.user?.role_id);
  const actingTenantId = useTenantStore((s) => s.actingTenantId);

  if (roleId === 1 && !actingTenantId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
        <Building2 size={40} className="text-gray-700" />
        <p className="text-sm font-medium text-gray-400">Selecciona un tenant en la barra superior para ver los datos</p>
      </div>
    );
  }

  return <>{children}</>;
}
