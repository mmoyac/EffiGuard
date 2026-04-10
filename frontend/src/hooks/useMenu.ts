import { useQuery } from "react-query";
import { menuApi } from "../services/api";
import { useAuthStore } from "../stores/authStore";
import type { MenuItem } from "../types";

export function useMenu() {
  const roleId = useAuthStore((s) => s.user?.role_id);

  return useQuery<MenuItem[]>(
    ["menu", roleId],  // cache por rol — al cambiar usuario se fetcha el menú correcto
    () => menuApi.get().then((r) => r.data),
    {
      staleTime: 5 * 60 * 1000,
      enabled: roleId !== undefined,  // no fetchar hasta tener el usuario cargado
    }
  );
}
