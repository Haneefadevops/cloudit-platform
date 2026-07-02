import type { ApiResult } from "./contracts";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers);

  if (options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    const data = (await response.json()) as ApiResult<T>;

    if (!response.ok || !data.ok) {
      const message = !data.ok ? data.error : `HTTP ${response.status}`;
      throw new ApiError(message, response.status);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred",
    };
  }
}

export function getPublicProfileUrl(slug: string): string {
  if (APP_BASE_URL) return `${APP_BASE_URL}/u/${slug}`;
  if (typeof window === "undefined") return `/u/${slug}`;
  return `${window.location.origin}/u/${slug}`;
}
