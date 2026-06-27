import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-platform.cloudit.lk";

export class ApiError extends Error {
  constructor(
    public message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getToken(): Promise<string | null> {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new ApiError(
      errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData.code
    );
    throw error;
  }

  return response;
}

export const api = {
  get: async <T>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetchWithAuth(url, { ...options, method: "GET" });
    if (response.status === 204) return {} as T;
    return response.json();
  },

  post: async <T>(url: string, body: unknown, options?: RequestInit): Promise<T> => {
    const response = await fetchWithAuth(url, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
    if (response.status === 204) return {} as T;
    return response.json();
  },

  put: async <T>(url: string, body: unknown, options?: RequestInit): Promise<T> => {
    const response = await fetchWithAuth(url, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (response.status === 204) return {} as T;
    return response.json();
  },

  patch: async <T>(url: string, body: unknown, options?: RequestInit): Promise<T> => {
    const response = await fetchWithAuth(url, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (response.status === 204) return {} as T;
    return response.json();
  },

  delete: async <T>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetchWithAuth(url, { ...options, method: "DELETE" });
    if (response.status === 204) return {} as T;
    return response.json();
  },
};

export function handleApiError(error: unknown): void {
  if (error instanceof ApiError) {
    toast.error(error.message);
  } else if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error("An unexpected error occurred");
  }
}
