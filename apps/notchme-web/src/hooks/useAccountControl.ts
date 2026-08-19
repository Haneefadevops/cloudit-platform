import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useExportAccount() {
  return useMutation({
    mutationFn: async () => {
      const result =
        await apiFetch<Record<string, unknown>>("/v2/account/export");
      if (!result.ok) throw new Error(result.error);
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `notchme-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (input: { password: string; confirmation: string }) => {
      const result = await apiFetch<{ deleted: true }>("/v2/account", {
        method: "DELETE",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      window.location.assign("/login?account=deleted");
    },
  });
}
