import { api, handleApiError } from "./api-client";
import type { User, Organization, LoginCredentials, RegisterData } from "@/types";

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface MeResponse {
  user: User;
  organizations: Organization[];
}

function setTokens(accessToken: string, refreshToken: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("token", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  }
}

function setUserData(user: User, organizations: Organization[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("organizations", JSON.stringify(organizations));
    const currentOrg = organizations[0] || null;
    if (currentOrg) {
      localStorage.setItem("organization", JSON.stringify(currentOrg));
    }
  }
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const data = await api.post<AuthResponse>("/auth/login", credentials);
  setTokens(data.accessToken, data.refreshToken);
  const orgs = (data.user as any).members?.map((m: any) => m.organization) || [];
  setUserData(data.user, orgs);
  return data;
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/register", data);
  setTokens(response.accessToken, response.refreshToken);
  const orgs = (response.user as any).members?.map((m: any) => m.organization) || [];
  setUserData(response.user, orgs);
  return response;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post("/auth/forgot-password", { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post("/auth/reset-password", { token, password });
}

export async function logout(): Promise<void> {
  const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;
  try {
    if (refreshToken) {
      await api.post("/auth/logout", { refreshToken });
    }
  } catch {
    // ignore
  } finally {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      localStorage.removeItem("organization");
      localStorage.removeItem("organizations");
    }
  }
}

export async function me(): Promise<MeResponse | null> {
  try {
    const data = await api.get<MeResponse>("/auth/me");
    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("organizations", JSON.stringify(data.organizations));
      const currentOrg = data.organizations[0] || null;
      if (currentOrg) {
        localStorage.setItem("organization", JSON.stringify(currentOrg));
      }
    }
    return data;
  } catch {
    return null;
  }
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

export function getStoredOrganization(): Organization | null {
  if (typeof window === "undefined") return null;
  const org = localStorage.getItem("organization");
  return org ? JSON.parse(org) : null;
}

export function getStoredOrganizations(): Organization[] {
  if (typeof window === "undefined") return [];
  const orgs = localStorage.getItem("organizations");
  return orgs ? JSON.parse(orgs) : [];
}
