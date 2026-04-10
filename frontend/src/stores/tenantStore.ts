import { create } from "zustand";

interface TenantState {
  actingTenantId: number | null;
  actingTenantName: string | null;
  setActingTenant: (id: number, name: string) => void;
  clearActingTenant: () => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  actingTenantId: null,
  actingTenantName: null,

  setActingTenant: (id, name) => {
    set({ actingTenantId: id, actingTenantName: name });
    // Recargar datos del nuevo tenant
    import("../main").then(({ queryClient }) => {
      queryClient.invalidateQueries();
    });
  },

  clearActingTenant: () => {
    set({ actingTenantId: null, actingTenantName: null });
    import("../main").then(({ queryClient }) => {
      queryClient.invalidateQueries();
    });
  },
}));
