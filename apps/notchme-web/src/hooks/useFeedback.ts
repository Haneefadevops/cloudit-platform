import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { FeedbackRequest, FeedbackRequestInput, FeedbackTokenInfo } from "@/lib/contracts";

export function useCustomerFeedback(customerId: string | undefined) {
  return useQuery<FeedbackRequest[]>({
    queryKey: ["customers", customerId, "feedback"],
    queryFn: async () => {
      const result = await apiFetch<FeedbackRequest[]>(`/v2/customers/${customerId}/feedback`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!customerId,
  });
}

export function useCreateFeedbackRequest(customerId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<FeedbackRequest, Error, FeedbackRequestInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<FeedbackRequest>(`/v2/customers/${customerId}/feedback`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", customerId, "feedback"] });
      qc.invalidateQueries({ queryKey: ["customers", customerId, "activities"] });
    },
  });
}

export function useFeedbackTokenInfo(token: string | undefined) {
  return useQuery<FeedbackTokenInfo>({
    queryKey: ["feedback", token],
    queryFn: async () => {
      const result = await apiFetch<FeedbackTokenInfo>(`/v2/feedback/${token}`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!token,
  });
}

export function useMarkFeedbackSent(token: string | undefined) {
  const qc = useQueryClient();
  return useMutation<{ sent: boolean }, Error>({
    mutationFn: async () => {
      const result = await apiFetch<{ sent: boolean }>(`/v2/feedback/${token}/sent`, {
        method: "POST",
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback", token] });
    },
  });
}
