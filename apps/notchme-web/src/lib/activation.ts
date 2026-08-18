import type { MeetingType, Profile } from "@/lib/contracts";

export type ActivationChecklistState = {
  profileComplete: boolean;
  publicPageReady: boolean;
  bookingConfigured: boolean;
  shareReady: boolean;
};

export function deriveActivationChecklistState(
  profile: Profile | null | undefined,
  meetingTypes: MeetingType[] | undefined,
): ActivationChecklistState {
  const profileComplete = Boolean(profile?.fullName.trim() && profile?.headline?.trim());
  const publicPageReady = Boolean(
    profile?.slug &&
      profile?.headline?.trim() &&
      (profile.email || profile.phone || profile.websiteUrl),
  );

  return {
    profileComplete,
    publicPageReady,
    bookingConfigured: Boolean(meetingTypes?.some((meetingType) => meetingType.isActive)),
    shareReady: Boolean(profile?.isPublished),
  };
}
