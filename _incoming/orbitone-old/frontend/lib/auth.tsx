"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { apiFetch } from "./api";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
};

type AuthState =
  | { status: "loading"; user: null; error: null }
  | { status: "authenticated"; user: AuthUser; error: null }
  | { status: "unauthenticated"; user: null; error: null }
  | { status: "error"; user: null; error: string };

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    const result = await apiFetch<AuthUser>("/auth/me");

    if (result.ok) {
      setState({ status: "authenticated", user: result.data, error: null });
    } else {
      setState({ status: "unauthenticated", user: null, error: null });
    }
  }, []);

  useEffect(() => {
    // Initial auth check on mount. Required to sync auth state with the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiFetch<AuthUser>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!result.ok) {
        setState({ status: "error", user: null, error: result.error });
        throw new Error(result.error);
      }

      setState({ status: "authenticated", user: result.data, error: null });
    },
    []
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const result = await apiFetch<AuthUser>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ fullName, email, password }),
      });

      if (!result.ok) {
        setState({ status: "error", user: null, error: result.error });
        throw new Error(result.error);
      }

      setState({ status: "authenticated", user: result.data, error: null });
    },
    []
  );

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setState({ status: "unauthenticated", user: null, error: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
