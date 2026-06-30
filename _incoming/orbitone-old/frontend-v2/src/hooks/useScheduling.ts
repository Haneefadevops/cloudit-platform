import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  MeetingType,
  MeetingTypeInput,
  SchedulingAvailability,
  AvailabilityRuleInput,
  AvailabilityExceptionInput,
  Booking,
  BookingCancelInput,
} from "@/lib/contracts";

export function useMeetingTypes() {
  return useQuery<MeetingType[]>({
    queryKey: ["scheduling", "meeting-types"],
    queryFn: async () => {
      const result = await apiFetch<MeetingType[]>("/v2/scheduling/meeting-types");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCreateMeetingType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MeetingTypeInput) => {
      const result = await apiFetch<MeetingType>("/v2/scheduling/meeting-types", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduling", "meeting-types"] });
    },
  });
}

export function useUpdateMeetingType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<MeetingTypeInput> }) => {
      const result = await apiFetch<MeetingType>(`/v2/scheduling/meeting-types/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduling", "meeting-types"] });
    },
  });
}

export function useDeleteMeetingType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiFetch<{ deleted: true }>(`/v2/scheduling/meeting-types/${id}`, {
        method: "DELETE",
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduling", "meeting-types"] });
    },
  });
}

export function useAvailability() {
  return useQuery<SchedulingAvailability>({
    queryKey: ["scheduling", "availability"],
    queryFn: async () => {
      const result = await apiFetch<SchedulingAvailability>("/v2/scheduling/availability");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useUpdateAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rules,
      exceptions,
    }: {
      rules: AvailabilityRuleInput[];
      exceptions: AvailabilityExceptionInput[];
    }) => {
      const result = await apiFetch<SchedulingAvailability>("/v2/scheduling/availability", {
        method: "PUT",
        body: JSON.stringify({ rules, exceptions }),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduling", "availability"] });
    },
  });
}

export function useBookings() {
  return useQuery<Booking[]>({
    queryKey: ["scheduling", "bookings"],
    queryFn: async () => {
      const result = await apiFetch<Booking[]>("/v2/scheduling/bookings");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const result = await apiFetch<Booking>(`/v2/scheduling/bookings/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason } satisfies BookingCancelInput),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduling", "bookings"] });
    },
  });
}

export function useApproveBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiFetch<Booking>(`/v2/scheduling/bookings/${id}/approve`, {
        method: "POST",
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduling", "bookings"] });
    },
  });
}

export function useDeclineBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const result = await apiFetch<Booking>(`/v2/scheduling/bookings/${id}/decline`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduling", "bookings"] });
    },
  });
}
