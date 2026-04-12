import axios from "axios";
import { useTenantStore } from "../stores/tenantStore";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({ baseURL: BASE_URL });

// Inyectar token y acting tenant en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Si el super admin tiene un tenant seleccionado, lo inyectamos
  const actingTenantId = useTenantStore.getState().actingTenantId;
  if (actingTenantId) config.headers["X-Acting-Tenant"] = String(actingTenantId);

  return config;
});

// Refrescar token expirado automáticamente
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  me: () => api.get("/auth/me"),
};

export const menuApi = {
  get: () => api.get("/menu"),
};

export const assetsApi = {
  list: (skip = 0, limit = 50) => api.get(`/assets?skip=${skip}&limit=${limit}`),
  getById: (id: number) => api.get(`/assets/${id}`),
  scan: (uid: string) => api.get(`/assets/scan/${uid}`),
  lowStock: () => api.get("/assets/low-stock"),
  update: (id: number, data: object) => api.patch(`/assets/${id}`, data),
  reportLoss: (id: number, data: object) => api.post(`/assets/${id}/loss`, data),
  adjustStock: (id: number, data: object) => api.post(`/assets/${id}/adjust`, data),
};

export const loansApi = {
  list: (activeOnly = false) => api.get(`/loans?active_only=${activeOnly}`),
  create: (data: object) => api.post("/loans", data),
  return: (id: number, obs?: string) => api.post(`/loans/${id}/return`, { observaciones: obs }),
  withdrawConsumable: (data: object) => api.post("/loans/consumables/withdraw", data),
  activeByAsset: (assetId: number) => api.get(`/loans/active/asset/${assetId}`),
};

export const usersApi = {
  list: () => api.get("/users?limit=200"),
};

export const projectsApi = {
  list: () => api.get("/projects"),
};

export const catalogApi = {
  brands: () => api.get("/catalog/brands"),
  models: (brandId?: number) => api.get(`/catalog/models${brandId ? `?brand_id=${brandId}` : ""}`),
  states: () => api.get("/catalog/states"),
};

export const adminApi = {
  // Tenants
  listTenants: () => api.get("/admin/tenants"),
  createTenant: (d: object) => api.post("/admin/tenants", d),
  updateTenant: (id: number, d: object) => api.patch(`/admin/tenants/${id}`, d),
  tenantSummary: (id: number) => api.get(`/admin/tenants/${id}/summary`),
  // Usuarios globales
  listUsers: (tenantId?: number) => api.get(`/admin/users${tenantId ? `?tenant_id=${tenantId}` : ""}`),
  createUser: (d: object) => api.post("/admin/users", d),
  updateUser: (id: number, d: object) => api.patch(`/admin/users/${id}`, d),
  // Roles
  listRoles: () => api.get("/admin/roles"),
  // Estados de activo
  listAssetStates: () => api.get("/admin/asset-states"),
  createAssetState: (d: object) => api.post("/admin/asset-states", d),
  updateAssetState: (id: number, d: object) => api.patch(`/admin/asset-states/${id}`, d),
  deleteAssetState: (id: number) => api.delete(`/admin/asset-states/${id}`),
  // Módulos
  listModules: () => api.get("/admin/modules"),
  createModule: (d: object) => api.post("/admin/modules", d),
  updateModule: (id: number, d: object) => api.patch(`/admin/modules/${id}`, d),
  deleteModule: (id: number) => api.delete(`/admin/modules/${id}`),
  // Ítems de menú
  listMenuItems: () => api.get("/admin/menu-items"),
  createMenuItem: (d: object) => api.post("/admin/menu-items", d),
  updateMenuItem: (id: number, d: object) => api.patch(`/admin/menu-items/${id}`, d),
  deleteMenuItem: (id: number) => api.delete(`/admin/menu-items/${id}`),
  // Permisos
  listPermissions: (roleId?: number) => api.get(`/admin/permissions${roleId ? `?role_id=${roleId}` : ""}`),
  setPermissions: (roleId: number, menuItemIds: number[]) =>
    api.put("/admin/permissions", { role_id: roleId, menu_item_ids: menuItemIds }),
};
