import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type MeetingRecap = {
  id: string;
  bookingId: string;
  customerId: string;
  status: "draft" | "finalized";
  source: "manual" | "ai_assisted";
  summary: string;
  keyPoints: string[];
  commitments: string[];
  privateNote: string | null;
  proposedFollowUpTitle: string | null;
  proposedFollowUpDueAt: string | null;
  finalizedAt: string | null;
  updatedAt: string;
};

export type MeetingRecapDraft = {
  summary: string;
  keyPoints: string[];
  commitments: string[];
  privateNote?: string | null;
  proposedFollowUpTitle?: string | null;
  proposedFollowUpDueAt?: string | null;
};

export type AiRecapAvailability = {
  enabled: boolean;
  monthlyUsed: number;
  monthlyLimit: number;
  remaining: number;
  maxAudioBytes: number;
  acceptedAudioTypes: string[];
  retention: string;
};

export function useMeetingRecap(bookingId: string, enabled = true) {
  return useQuery<MeetingRecap | null>({
    queryKey: ["meeting-recap", bookingId],
    enabled: enabled && !!bookingId,
    queryFn: async () => {
      const result = await apiFetch<MeetingRecap | null>(
        `/v2/scheduling/bookings/${bookingId}/recap`,
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useAiRecapAvailability(bookingId: string, enabled = true) {
  return useQuery<AiRecapAvailability>({
    queryKey: ["meeting-recap-ai", bookingId],
    enabled: enabled && !!bookingId,
    queryFn: async () => {
      const result = await apiFetch<AiRecapAvailability>(
        `/v2/scheduling/bookings/${bookingId}/recap/ai`,
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

function useRecapInvalidation(bookingId: string, customerId?: string | null) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["meeting-recap", bookingId] }),
      queryClient.invalidateQueries({ queryKey: ["scheduling", "bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["people"] }),
      ...(customerId
        ? [
            queryClient.invalidateQueries({
              queryKey: ["customers", customerId, "activities"],
            }),
            queryClient.invalidateQueries({
              queryKey: ["customers", customerId, "follow-ups"],
            }),
          ]
        : []),
    ]);
  };
}

export function useSaveMeetingRecap(
  bookingId: string,
  customerId?: string | null,
) {
  const invalidate = useRecapInvalidation(bookingId, customerId);
  return useMutation({
    mutationFn: async (draft: MeetingRecapDraft) => {
      const result = await apiFetch<MeetingRecap>(
        `/v2/scheduling/bookings/${bookingId}/recap`,
        { method: "PUT", body: JSON.stringify(draft) },
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteMeetingRecap(
  bookingId: string,
  customerId?: string | null,
) {
  const invalidate = useRecapInvalidation(bookingId, customerId);
  return useMutation({
    mutationFn: async () => {
      const result = await apiFetch<{ deleted: true }>(
        `/v2/scheduling/bookings/${bookingId}/recap`,
        { method: "DELETE" },
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });
}

export function useFinalizeMeetingRecap(
  bookingId: string,
  customerId?: string | null,
) {
  const invalidate = useRecapInvalidation(bookingId, customerId);
  return useMutation({
    mutationFn: async (input: {
      createFollowUp: boolean;
      followUpTitle?: string;
      followUpDueAt?: string;
    }) => {
      const result = await apiFetch<{
        recap: MeetingRecap;
        alreadyFinalized: boolean;
        followUpCreated: boolean;
        followUpId?: string | null;
      }>(`/v2/scheduling/bookings/${bookingId}/recap/finalize`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });
}

export function useGenerateAiMeetingRecap(
  bookingId: string,
  customerId?: string | null,
) {
  const invalidate = useRecapInvalidation(bookingId, customerId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ audio }: { audio: File }) => {
      const form = new FormData();
      form.append("audio", audio);
      form.append("consent", "true");
      const result = await apiFetch<{
        recap: MeetingRecap;
        usage: {
          monthlyUsed: number;
          monthlyLimit: number;
          remaining: number;
        };
        audioRetained: false;
        transcriptRetained: false;
      }>(`/v2/scheduling/bookings/${bookingId}/recap/ai`, {
        method: "POST",
        body: form,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({
        queryKey: ["meeting-recap-ai", bookingId],
      });
    },
  });
}
