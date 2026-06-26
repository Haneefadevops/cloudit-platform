import { api, handleApiError } from "./api-client";
import type { User, Organization, LoginCredentials, RegisterData } from "@/types";

export interface AuthResponse {
  user: User;
  token: string;
  organization: Organization;
  organizations: Organization[];
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const data = await api.post<AuthResponse>("/auth/login", credentials);
  if (typeof window !== "undefined") {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("organization", JSON.stringify(data.organization));
    localStorage.setItem("organizations", JSON.stringify(data.organizations));
  }
  return data;
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/register", data);
  if (typeof window !== "undefined") {
    localStorage.setItem("token", response.token);
    localStorage.setItem("user", JSON.stringify(response.user));
    localStorage.setItem("organization", JSON.stringify(response.organization));
    localStorage.setItem("organizations", JSON.stringify(response.organizations));
  }
  return response;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post("/auth/forgot-password", { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post("/auth/reset-password", { token, password });
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout", {});
  } catch {
    // ignore
  } finally {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("organization");
      localStorage.removeItem("organizations");
    }
  }
}

export async function me(): Promise<{ user: User; organization: Organization; organizations: Organization[] } | null> {
  try {
    const data = await api.get<{ user: User; organization: Organization; organizations: Organization[] }>("/auth/me");
    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("organization", JSON.stringify(data.organization));
      localStorage.setItem("organizations", JSON.stringify(data.organizations));
    }
    return data;
  } catch {
    return null;
  }
}

export async function switchOrganization(orgId: string): Promise<{ user: User; organization: Organization }> {
  const data = await api.post<{ user: User; organization: Organization }>("/auth/switch-org", { organizationId: orgId });
  if (typeof window !== "undefined") {
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("organization", JSON.stringify(data.organization));
  }
  return data;
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
