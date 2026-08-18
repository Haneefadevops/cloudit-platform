import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { User, Plan } from "@/lib/contracts";

export function useUpgradePlan() {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();

  return useMutation({
    mutationFn: async (plan: Plan) => {
      const result = await apiFetch<User>("/v2/billing/upgrade", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: async () => {
      await refresh();
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "me"] });
    },
  });
}
