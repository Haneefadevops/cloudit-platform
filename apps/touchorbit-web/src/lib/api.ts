const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://api-touchorbit.cloudit.lk"
).replace(/\/$/, "");

export interface ApiError extends Error {
  status?: number;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  const payload = await res.json().catch(() => ({}));
  // Backend wraps controller results in { success: true, data: { ok, data|error } }
  const result = payload?.data ?? payload;

  if (!res.ok || result?.ok === false) {
    const message =
      result?.error || payload?.message || `Request failed (${res.status})`;
    const err = new Error(message) as ApiError;
    err.status = res.status;
    throw err;
  }

  return (result?.data ?? result) as T;
}
