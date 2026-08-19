import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const result = await apiFetch<{ accepted: true; message: string }>(
        "/v2/auth/forgot-password",
        { method: "POST", body: JSON.stringify({ email }) },
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: { token: string; password: string }) => {
      const result = await apiFetch<{ reset: true }>(
        "/v2/auth/reset-password",
        { method: "POST", body: JSON.stringify(input) },
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useRequestVerification() {
  return useMutation({
    mutationFn: async () => {
      const result = await apiFetch<{ requested: true }>(
        "/v2/auth/request-verification",
        { method: "POST" },
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: async (token: string) => {
      const result = await apiFetch<{ verified: true }>(
        "/v2/auth/verify-email",
        {
          method: "POST",
          body: JSON.stringify({ token }),
        },
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}
