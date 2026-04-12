import { create } from "zustand";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem("access_token"),

  setTokens: (access, refresh) => {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    set({ isAuthenticated: true });
  },

  setUser: (user) => {
    if (user.tenant_logo_url) {
      localStorage.setItem("tenant_logo_url", user.tenant_logo_url);
    }
    set({ user });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("tenant_logo_url");
    set({ user: null, isAuthenticated: false });
    // Limpiar todo el cache de React Query para que el próximo usuario no vea datos del anterior
    import("../main").then(({ queryClient }) => queryClient.clear());
  },
}));
