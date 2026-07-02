import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { DashboardSummary } from "@/lib/contracts";

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const result = await apiFetch<DashboardSummary>("/v2/dashboard/summary");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}
