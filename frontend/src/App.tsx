import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { authApi } from "./services/api";
import { usePWAManifest } from "./hooks/usePWAManifest";
import { Layout } from "./components/layout/Layout";
import { PWAUpdatePrompt } from "./components/PWAUpdatePrompt";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Catalogo } from "./pages/Catalogo";
import { Proveedores } from "./pages/Proveedores";
import { EscanearCatalogo } from "./pages/EscanearCatalogo";
import { Loans } from "./pages/Loans";
import { Inventory } from "./pages/Inventory";
import { Bodega } from "./pages/Bodega";
import { MyLoans } from "./pages/MyLoans";
import { Users } from "./pages/Users";
import { Projects } from "./pages/Projects";
import { Ubicaciones } from "./pages/Ubicaciones";
import { AdminTenants } from "./pages/admin/AdminTenants";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminAssetStates } from "./pages/admin/AdminAssetStates";
import { AdminModules } from "./pages/admin/AdminModules";
import { AdminMenuItems } from "./pages/admin/AdminMenuItems";
import { AdminPermissions } from "./pages/admin/AdminPermissions";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Dónde empieza —y a dónde vuelve— cada rol. El operario no ve el dashboard. */
function inicioDe(roleId?: number) {
  return roleId === 4 ? "/my-loans" : "/";
}

function HomeRedirect() {
  const roleId = useAuthStore((s) => s.user?.role_id);
  // role_id 4 = operario → va directo a sus préstamos
  if (roleId === 4) return <Navigate to="/my-loans" replace />;
  return <Dashboard />;
}

// Roles con acceso a las pantallas de mantención y despacho. El operario consulta
// y devuelve; no mantiene catálogo ni mueve stock.
const SIN_OPERARIO = [1, 2, 3];
const SOLO_SUPER_ADMIN = [1];

/**
 * Corte por rol en el cliente.
 *
 * Es de usabilidad, no de seguridad —el backend sigue siendo la autoridad—: sin
 * esto, un operario que tipea `/users` abre una pantalla vacía y rota, y concluye
 * que la aplicación falla.
 *
 * La lista se declara junto a cada ruta y no se deriva de `GET /menu` a propósito:
 * derivarla convertiría "Administración → Permisos" en una superficie de
 * autorización, donde editar la navegación abriría rutas sin querer.
 */
function RoleRoute({ roles, children }: { roles: number[]; children: React.ReactNode }) {
  const roleId = useAuthStore((s) => s.user?.role_id);
  // Mientras `/auth/me` hidrata el store no hay rol que evaluar: cortar acá
  // expulsaría al usuario de su propia pantalla en cada recarga.
  if (roleId === undefined) return null;
  if (!roles.includes(roleId)) return <Navigate to={inicioDe(roleId)} replace />;
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated, setUser, logout } = useAuthStore();
  usePWAManifest();

  useEffect(() => {
    if (!isAuthenticated) return;
    authApi.me()
      .then((r) => setUser(r.data))
      .catch(() => logout());
  }, []);

  return (
    <>
      <PWAUpdatePrompt />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<HomeRedirect />} />
            <Route path="catalogo" element={<RoleRoute roles={SIN_OPERARIO}><Catalogo /></RoleRoute>} />
            <Route path="catalogo/scan" element={<RoleRoute roles={SIN_OPERARIO}><EscanearCatalogo /></RoleRoute>} />
            <Route path="proveedores" element={<RoleRoute roles={SIN_OPERARIO}><Proveedores /></RoleRoute>} />
            <Route path="loans" element={<RoleRoute roles={SIN_OPERARIO}><Loans /></RoleRoute>} />
            <Route path="inventory" element={<RoleRoute roles={SIN_OPERARIO}><Inventory /></RoleRoute>} />
            {/* Sin RoleRoute: la consulta de bodega es de todos, y "Mis Préstamos"
                muestra sólo los del que pregunta. */}
            <Route path="bodega" element={<Bodega />} />
            <Route path="my-loans" element={<MyLoans />} />
            <Route path="users" element={<RoleRoute roles={SIN_OPERARIO}><Users /></RoleRoute>} />
            <Route path="projects" element={<RoleRoute roles={SIN_OPERARIO}><Projects /></RoleRoute>} />
            <Route path="ubicaciones" element={<RoleRoute roles={SIN_OPERARIO}><Ubicaciones /></RoleRoute>} />
            <Route path="admin/tenants" element={<RoleRoute roles={SOLO_SUPER_ADMIN}><AdminTenants /></RoleRoute>} />
            <Route path="admin/users" element={<RoleRoute roles={SOLO_SUPER_ADMIN}><AdminUsers /></RoleRoute>} />
            <Route path="admin/asset-states" element={<RoleRoute roles={SOLO_SUPER_ADMIN}><AdminAssetStates /></RoleRoute>} />
            <Route path="admin/modules" element={<RoleRoute roles={SOLO_SUPER_ADMIN}><AdminModules /></RoleRoute>} />
            <Route path="admin/menu-items" element={<RoleRoute roles={SOLO_SUPER_ADMIN}><AdminMenuItems /></RoleRoute>} />
            <Route path="admin/permissions" element={<RoleRoute roles={SOLO_SUPER_ADMIN}><AdminPermissions /></RoleRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
