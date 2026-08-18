import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { AnalyticsSummary } from "@/lib/contracts";

export function useAnalyticsMe() {
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics", "me"],
    queryFn: async () => {
      const result = await apiFetch<AnalyticsSummary>("/v2/analytics/me");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}
