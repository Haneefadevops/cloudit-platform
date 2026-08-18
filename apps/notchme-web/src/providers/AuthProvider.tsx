import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { AuthContext } from "./auth-context";
import type { AuthMe, User } from "@/lib/contracts";

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: User; profile: AuthMe["profile"]; organization: AuthMe["organization"] }
  | { status: "unauthenticated" };

export interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  register: (input: { fullName: string; email: string; password: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

async function fetchMe(): Promise<AuthState> {
  const result = await apiFetch<AuthMe>("/v2/auth/me");
  if (result.ok) {
    return {
      status: "authenticated",
      user: result.data.user,
      profile: result.data.profile,
      organization: result.data.organization,
    };
  }
  return { status: "unauthenticated" };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<User>("/v2/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!result.ok) return result;
    setState(await fetchMe());
    return { ok: true as const };
  }, []);

  const register = useCallback(async (input: { fullName: string; email: string; password: string }) => {
    const result = await apiFetch<User>("/v2/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!result.ok) return result;
    setState(await fetchMe());
    return { ok: true as const };
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/v2/auth/logout", { method: "POST" });
    queryClient.clear();
    setState({ status: "unauthenticated" });
  }, []);

  const refresh = useCallback(async () => {
    setState(await fetchMe());
  }, []);

  return (
    <AuthContext.Provider value={{ state, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
