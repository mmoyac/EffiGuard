import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { authApi } from "./services/api";
import { usePWAManifest } from "./hooks/usePWAManifest";
import { Layout } from "./components/layout/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Assets } from "./pages/Assets";
import { AssetEdit } from "./pages/AssetEdit";
import { Loans } from "./pages/Loans";
import { Inventory } from "./pages/Inventory";
import { Scanner } from "./pages/Scanner";
import { MyLoans } from "./pages/MyLoans";
import { Users } from "./pages/Users";
import { Projects } from "./pages/Projects";
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

function HomeRedirect() {
  const roleId = useAuthStore((s) => s.user?.role_id);
  // role_id 4 = operario → va directo a sus préstamos
  if (roleId === 4) return <Navigate to="/my-loans" replace />;
  return <Dashboard />;
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
          <Route path="assets" element={<Assets />} />
          <Route path="assets/:id/edit" element={<AssetEdit />} />
          <Route path="assets/scan" element={<Scanner />} />
          <Route path="loans" element={<Loans />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="my-loans" element={<MyLoans />} />
          <Route path="users" element={<Users />} />
          <Route path="projects" element={<Projects />} />
          <Route path="admin/tenants" element={<AdminTenants />} />
          <Route path="admin/users" element={<AdminUsers />} />
          <Route path="admin/asset-states" element={<AdminAssetStates />} />
          <Route path="admin/modules" element={<AdminModules />} />
          <Route path="admin/menu-items" element={<AdminMenuItems />} />
          <Route path="admin/permissions" element={<AdminPermissions />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
