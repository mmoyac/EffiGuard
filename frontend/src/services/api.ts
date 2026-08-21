import axios from "axios";
import { useTenantStore } from "../stores/tenantStore";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
// URL base sin el prefijo /api/v1 (para archivos estáticos)
const MEDIA_BASE = BASE_URL.replace(/\/api\/v1\/?$/, "");

/** Convierte una ruta relativa de servidor (e.g. /static/logos/x.png) en URL absoluta. */
export function getMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${MEDIA_BASE}${path}`;
}

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
  googleLogin: (idToken: string) =>
    api.post("/auth/google", { id_token: idToken }),
  me: () => api.get("/auth/me"),
};

export const menuApi = {
  get: () => api.get("/menu"),
};



export const loansApi = {
  list: (activeOnly = false) => api.get(`/loans?active_only=${activeOnly}`),
  my: () => api.get("/loans/my"),
  activeByUnidad: (unidadId: number) => api.get(`/loans/active/unidad/${unidadId}`),
  disponibles: (varianteId: number) => api.get(`/loans/disponibles/${varianteId}`),
  piezasDelKit: (unidadId: number) => api.get(`/loans/kit/${unidadId}`),
  create: (d: object) => api.post("/loans", d),
  return_: (loanId: number, d: object) => api.post(`/loans/${loanId}/return`, d),
};

export const usersApi = {
  list: (roleId?: number) =>
    api.get(`/users?limit=200${roleId ? `&role_id=${roleId}` : ""}`),
  scanByCredential: (uid: string) => api.get(`/users/scan/${encodeURIComponent(uid)}`),
};

/** role_id 4. Quien retira material en terreno es un operario. */
export const ROL_OPERARIO = 4;

export const projectsApi = {
  /** `soloActivos` para selectores operativos: una obra cerrada no admite consumo. */
  list: (soloActivos = false) =>
    api.get(`/projects${soloActivos ? "?solo_activos=true" : ""}`),
};

export const ubicacionesApi = {
  list: () => api.get("/ubicaciones"),
  racks: () => api.get("/ubicaciones/racks"),
  niveles: (rack: string) => api.get(`/ubicaciones/niveles?rack=${encodeURIComponent(rack)}`),
  posiciones: (rack: string, nivel: string) =>
    api.get(`/ubicaciones/posiciones?rack=${encodeURIComponent(rack)}&nivel=${encodeURIComponent(nivel)}`),
  create: (d: object) => api.post("/ubicaciones", d),
  update: (id: number, d: object) => api.patch(`/ubicaciones/${id}`, d),
  remove: (id: number) => api.delete(`/ubicaciones/${id}`),
};

/**
 * Consulta de bodega: sólo lectura, sin costos.
 * Responde "¿hay, y dónde está?" para cualquier rol del tenant.
 */
export const bodegaApi = {
  buscar: (q: string) => api.get(`/bodega/buscar?q=${encodeURIComponent(q)}`),
};

export const catalogApi = {
  brands: () => api.get("/catalog/brands"),
  models: (brandId?: number) => api.get(`/catalog/models${brandId ? `?brand_id=${brandId}` : ""}`),
  states: () => api.get("/catalog/states"),
};

/**
 * Catálogo producto → variante → unidad.
 * Convive con `assetsApi` mientras dura la migración por tramos: éste sirve la
 * carga, aquél sigue sirviendo préstamos, escaneo e inventario.
 */
export const catalogoApi = {
  listProductos: (params?: { comportamiento?: string; buscar?: string }) => {
    const q = new URLSearchParams();
    if (params?.comportamiento) q.set("comportamiento", params.comportamiento);
    if (params?.buscar) q.set("buscar", params.buscar);
    return api.get(`/productos${q.toString() ? `?${q}` : ""}`);
  },
  getProducto: (id: number) => api.get(`/productos/${id}`),
  createProducto: (d: object) => api.post("/productos", d),
  updateProducto: (id: number, d: object) => api.patch(`/productos/${id}`, d),
  deleteProducto: (id: number) => api.delete(`/productos/${id}`),

  listVariantes: (params?: { comportamiento?: string; buscar?: string; producto_id?: number }) => {
    const q = new URLSearchParams();
    if (params?.comportamiento) q.set("comportamiento", params.comportamiento);
    if (params?.buscar) q.set("buscar", params.buscar);
    if (params?.producto_id) q.set("producto_id", String(params.producto_id));
    return api.get(`/variantes${q.toString() ? `?${q}` : ""}`);
  },
  getVariante: (id: number) => api.get(`/variantes/${id}`),
  lowStock: () => api.get("/variantes/low-stock"),
  createVariante: (productoId: number, d: object) => api.post(`/productos/${productoId}/variantes`, d),
  updateVariante: (id: number, d: object) => api.patch(`/variantes/${id}`, d),
  deleteVariante: (id: number) => api.delete(`/variantes/${id}`),

  listUnidades: (varianteId: number) => api.get(`/variantes/${varianteId}/unidades`),
  createUnidades: (varianteId: number, d: object) => api.post(`/variantes/${varianteId}/unidades`, d),
  updateUnidad: (id: number, d: object) => api.patch(`/unidades/${id}`, d),
  deleteUnidad: (id: number) => api.delete(`/unidades/${id}`),

  addCodigoVariante: (varianteId: number, d: object) => api.post(`/variantes/${varianteId}/codigos`, d),
  addCodigoUnidad: (unidadId: number, d: object) => api.post(`/unidades/${unidadId}/codigos`, d),
  setCodigoPrincipal: (id: number) => api.patch(`/codigos/${id}/principal`),
  deleteCodigo: (id: number) => api.delete(`/codigos/${id}`),

  familias: () => api.get("/asset-families"),

  scan: (codigo: string) => api.get(`/scan-catalogo/${encodeURIComponent(codigo)}`),

  purchase: (varianteId: number, d: object) => api.post(`/variantes/${varianteId}/purchase`, d),
  withdraw: (varianteId: number, d: object) => api.post(`/variantes/${varianteId}/withdraw`, d),
  adjust: (varianteId: number, d: object) => api.post(`/variantes/${varianteId}/adjust`, d),
  shrinkage: (varianteId: number, d: object) => api.post(`/variantes/${varianteId}/shrinkage`, d),
  loss: (varianteId: number, d: object) => api.post(`/variantes/${varianteId}/loss`, d),
  despachosPendientes: (varianteId: number) =>
    api.get(`/variantes/${varianteId}/despachos-pendientes`),
  reintegro: (varianteId: number, d: object) => api.post(`/variantes/${varianteId}/reintegro`, d),
  repairDone: (unidadId: number, d: object) => api.post(`/unidades/${unidadId}/repair-done`, d),
  lossUnidad: (unidadId: number, d: object) => api.post(`/unidades/${unidadId}/loss`, d),
  reingresoUnidad: (unidadId: number, d: object) => api.post(`/unidades/${unidadId}/reingreso`, d),
  movimientos: (varianteId: number) => api.get(`/variantes/${varianteId}/movimientos`),

  listProveedores: () => api.get("/proveedores"),
  createProveedor: (d: object) => api.post("/proveedores", d),
  updateProveedor: (id: number, d: object) => api.patch(`/proveedores/${id}`, d),
  deleteProveedor: (id: number) => api.delete(`/proveedores/${id}`),

  importTemplate: () => api.get("/catalogo/import/template", { responseType: "blob" }),
  importValidate: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/catalogo/import?dry_run=true", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  importConfirm: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/catalogo/import?dry_run=false", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
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
  // API Keys
  listApiKeys: (tenantId: number) =>
    api.get("/api-keys", { headers: { "X-Acting-Tenant": String(tenantId) } }),
  createApiKey: (tenantId: number, description: string) =>
    api.post("/api-keys", { description }, { headers: { "X-Acting-Tenant": String(tenantId) } }),
  revokeApiKey: (tenantId: number, keyId: number) =>
    api.delete(`/api-keys/${keyId}`, { headers: { "X-Acting-Tenant": String(tenantId) } }),
  // Logo de tenant
  uploadTenantLogo: (tenantId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/admin/tenants/${tenantId}/logo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
