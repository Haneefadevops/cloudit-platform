const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-hospitality.cloudit.lk";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
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
    "X-Organization-Id": localStorage.getItem("organizationId") || "",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/api${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.message || `HTTP ${response.status}`, response.status);
  }

  return response;
}

export const api = {
  get: async <T>(url: string): Promise<T> => {
    const response = await fetchWithAuth(url);
    return response.json();
  },

  post: async <T>(url: string, body: unknown): Promise<T> => {
    const response = await fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return response.json();
  },

  patch: async <T>(url: string, body: unknown): Promise<T> => {
    const response = await fetchWithAuth(url, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return response.json();
  },

  delete: async <T>(url: string): Promise<T> => {
    const response = await fetchWithAuth(url, { method: "DELETE" });
    return response.json();
  },
};
