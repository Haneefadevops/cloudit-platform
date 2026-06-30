export type AnalyticsEventType =
  | "profile_view"
  | "qr_scan"
  | "vcard_download"
  | "connection_added"
  | "booking_page_view"
  | "booking_slot_selected"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_rescheduled";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type Profile = {
  id: string;
  userId: string;
  slug: string;
  fullName: string;
  headline: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  xUrl: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicProfile = Omit<Profile, "userId" | "isPublished" | "updatedAt">;

export type ProfileInput = {
  slug: string;
  fullName: string;
  headline?: string | null;
  company?: string | null;
  location?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
  xUrl?: string | null;
  isPublished?: boolean;
};

export type Connection = {
  id: string;
  ownerUserId: string;
  connectedProfileId: string | null;
  source: "public_profile" | "qr_code";
  relationshipStatus: RelationshipStatus;
  lifecycleStage: LifecycleStage;
  priority: ConnectionPriority;
  nextStep: string | null;
  lastContactedAt: string | null;
  fullName: string;
  headline: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  createdAt: string;
};

export type ProfileMetrics = {
  profileViews: number;
  qrScans: number;
  vcardDownloads: number;
  connectionsAdded: number;
};

export type TrackProfileEventInput = {
  profileId: string;
  eventType: AnalyticsEventType;
  visitorId?: string;
  referrer?: string;
  userAgent?: string;
};

export type NetworkConnectionStatus = "none" | "saved" | "saved_me" | "mutual";

export type NetworkProfile = {
  profile: PublicProfile;
  connectionStatus: NetworkConnectionStatus;
  connectedAt: string | null;
};

export type NetworkSummary = {
  savedByMe: number;
  savedMe: number;
  mutualConnections: number;
  discoverableProfiles: number;
};

export type RelationshipStatus =
  | "new"
  | "active"
  | "follow_up"
  | "opportunity"
  | "archived";

export type LifecycleStage =
  | "new"
  | "contacted"
  | "meeting"
  | "proposal"
  | "won"
  | "lost";

export type ConnectionPriority = "low" | "medium" | "high";

export type ConnectionActivityType = "note" | "call" | "email" | "meeting" | "other";

export type ConnectionActivity = {
  id: string;
  connectionId: string;
  ownerUserId: string;
  activityType: ConnectionActivityType;
  title: string;
  body: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionNote = {
  id: string;
  connectionId: string;
  ownerUserId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type Tag = {
  id: string;
  ownerUserId: string;
  name: string;
  color: string;
  createdAt: string;
};

export type FollowUp = {
  id: string;
  connectionId: string;
  ownerUserId: string;
  title: string;
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionRelationship = {
  connection: Connection;
  notes: ConnectionNote[];
  tags: Tag[];
  followUps: FollowUp[];
};

export type ConnectionCRM = {
  connection: Connection;
  activities: ConnectionActivity[];
};

export type CRMSummary = {
  lifecycle: Record<LifecycleStage, number>;
  highPriority: number;
  openFollowUps: number;
  overdueFollowUps: number;
};

export type Event = {
  id: string;
  ownerUserId: string;
  slug: string;
  name: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicEvent = Omit<Event, "ownerUserId" | "isPublished" | "updatedAt">;

export type EventCheckIn = {
  id: string;
  eventId: string;
  userId: string;
  profileId: string;
  checkedInAt: string;
};

export type EventAttendee = {
  userId: string;
  profile: PublicProfile;
  checkedInAt: string;
  connectionStatus: NetworkConnectionStatus;
  connectedAt: string | null;
};

export type CalendarProvider = "google" | "microsoft" | "zoho";

export type CalendarAccount = {
  id: string;
  ownerUserId: string;
  provider: CalendarProvider;
  providerAccountId: string | null;
  email: string | null;
  calendarId: string | null;
  isConnected: boolean;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarConnectResult = {
  authorizationUrl: string;
};

export type MeetingLocationType = "video" | "phone" | "in_person" | "custom";

export type MeetingType = {
  id: string;
  ownerUserId: string;
  slug: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  locationType: MeetingLocationType;
  locationValue: string | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  bookingWindowDays: number;
  maxBookingsPerDay: number | null;
  requiresApproval: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MeetingTypeInput = {
  slug?: string;
  title: string;
  description?: string | null;
  durationMinutes: number;
  locationType?: MeetingLocationType;
  locationValue?: string | null;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  minNoticeMinutes?: number;
  bookingWindowDays?: number;
  maxBookingsPerDay?: number | null;
  requiresApproval?: boolean;
  isActive?: boolean;
};

export type AvailabilityRule = {
  id: string;
  ownerUserId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AvailabilityException = {
  id: string;
  ownerUserId: string;
  exceptionDate: string;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  isAvailable: boolean;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AvailabilityRuleInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  isActive?: boolean;
};

export type AvailabilityExceptionInput = {
  exceptionDate: string;
  startTime?: string | null;
  endTime?: string | null;
  timezone: string;
  isAvailable?: boolean;
  reason?: string | null;
};

export type SchedulingAvailability = {
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
};

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "rescheduled";

export type BookingSource = "profile" | "connection" | "event" | "direct";

export type BookingGuest = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string | null;
  createdAt: string;
};

export type Booking = {
  id: string;
  ownerUserId: string;
  meetingTypeId: string;
  guestId: string;
  connectionId: string | null;
  eventId: string | null;
  source: BookingSource;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  timezone: string;
  cancellationReason: string | null;
  rescheduledFromBookingId: string | null;
  externalProvider: CalendarProvider | null;
  externalEventId: string | null;
  createdAt: string;
  updatedAt: string;
  meetingType?: MeetingType;
  guest?: BookingGuest;
};

export type BookingSlot = {
  startAt: string;
  endAt: string;
  timezone: string;
  available: boolean;
};

export type PublicBookingProfile = {
  profile: PublicProfile;
  meetingTypes: MeetingType[];
};

export type PublicBookingSlots = {
  profile: PublicProfile;
  meetingType: MeetingType;
  slots: BookingSlot[];
};

export type PublicBookingInput = {
  guestName: string;
  guestEmail: string;
  guestCompany?: string | null;
  guestMessage?: string | null;
  startAt: string;
  timezone: string;
  source?: BookingSource;
  connectionId?: string | null;
  eventId?: string | null;
};

export type PublicBookingConfirmation = {
  booking: Booking;
  profile: PublicProfile;
  guestTokens?: {
    reschedule: string;
    cancel: string;
  };
};
