import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  PublicBookingProfile,
  PublicBookingSlots,
  PublicBookingInput,
  PublicBookingConfirmation,
} from "@/lib/contracts";

export function usePublicBookingProfile(slug: string) {
  return useQuery<PublicBookingProfile>({
    queryKey: ["public-booking", "profile", slug],
    queryFn: async () => {
      const result = await apiFetch<PublicBookingProfile>(`/v2/book/${slug}`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: slug.length > 0,
  });
}

export function usePublicBookingSlots(
  slug: string,
  meetingTypeSlug: string,
  from: string,
  to: string,
  timezone: string
) {
  return useQuery<PublicBookingSlots>({
    queryKey: ["public-booking", "slots", slug, meetingTypeSlug, from, to, timezone],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to, timezone });
      const result = await apiFetch<PublicBookingSlots>(
        `/v2/book/${slug}/${meetingTypeSlug}/slots?${params.toString()}`
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: slug.length > 0 && meetingTypeSlug.length > 0 && from.length > 0 && to.length > 0,
  });
}

export function useCreatePublicBooking() {
  return useMutation({
    mutationFn: async ({
      slug,
      meetingTypeSlug,
      input,
    }: {
      slug: string;
      meetingTypeSlug: string;
      input: PublicBookingInput;
    }) => {
      const result = await apiFetch<PublicBookingConfirmation>(
        `/v2/book/${slug}/${meetingTypeSlug}/bookings`,
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}
