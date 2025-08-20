"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  refresh as apiRefresh,
  me as apiMe,
} from "./api/auth";
import { clearTokens, getAccessToken } from "./api/token";

export type AuthUser = { id: string; email: string } | null;

type AuthContextType = {
  user: AuthUser;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const me = await apiMe();
      setUser({ id: me.id, email: me.email });
    } catch (error) {
      console.error("Failed to refresh user:", error);
      // If we can't get user info, clear tokens and redirect to login
      clearTokens();
      setUser(null);
    }
  };

  useEffect(() => {
    async function bootstrap() {
      try {
        try {
          // Attempt one cookie-based refresh on load
          await apiRefresh();
        } catch (refreshError) {
          // It's okay if no cookie exists; user will be unauthenticated
          console.warn("Bootstrap refresh skipped/failed:", refreshError);
        }
        // Try to load user if access token is present
        if (getAccessToken()) {
          await refreshUser();
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Bootstrap failed:", error);
        clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: !!user && !!getAccessToken(),
      loading,
      async login(email: string, password: string) {
        setLoading(true);
        try {
          const res = await apiLogin(email, password);
          // Tokens are already set in apiLogin; ensure user is loaded
          await refreshUser();
        } finally {
          setLoading(false);
        }
      },
      async logout() {
        try {
          await apiLogout();
        } finally {
          clearTokens();
          setUser(null);
        }
      },
      refreshUser,
    }),
    [user, loading, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
