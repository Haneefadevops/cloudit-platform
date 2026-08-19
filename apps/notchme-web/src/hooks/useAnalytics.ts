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

export type ActionableInsights = {
  periodDays: 30;
  activity: {
    profileViews: number;
    profileViewsPrevious: number;
    newPeople: number;
    newPeoplePrevious: number;
    bookings: number;
    bookingsPrevious: number;
    completedFollowUps: number;
  };
  workflow: {
    overdueFollowUps: number;
    dueNextSevenDays: number;
    upcomingBookings: number;
    recapsToReview: number;
  };
  actions: Array<{
    kind: "overdue" | "recaps" | "publish" | "booking_setup";
    title: string;
    description: string;
    count: number;
    href: string;
  }>;
};

export function useActionableInsights(enabled: boolean) {
  return useQuery<ActionableInsights>({
    queryKey: ["analytics", "insights"],
    enabled,
    queryFn: async () => {
      const result = await apiFetch<ActionableInsights>(
        "/v2/analytics/insights",
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}
