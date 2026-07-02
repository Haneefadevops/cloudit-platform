import type { ApiResult } from "../../../contracts/orbitone.v2";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

if (import.meta.env.PROD && !API_BASE_URL.startsWith("https://") && !API_BASE_URL.startsWith("/")) {
  throw new Error("VITE_API_BASE_URL must use HTTPS or a same-origin path in production");
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...options?.headers,
      },
    });

    const data = (await response.json().catch(() => ({
      ok: false,
      error: "Unexpected response from server.",
    }))) as ApiResult<T>;

    if (!response.ok) {
      return {
        ok: false,
        error: typeof data === "object" && "error" in data ? String(data.error) : "Request failed.",
      };
    }

    return data;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error. Please check your connection.",
    };
  }
}
