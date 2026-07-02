import type {
  Profile,
  PublicProfile,
  User,
  Organization,
  AuthMe,
  MeetingType,
  AvailabilityRule,
  AvailabilityException,
  Booking,
  BookingGuest,
  PublicBookingProfile,
  BookingSlot,
  Customer,
  CustomerActivity,
  CustomerFollowUp,
  CustomerRating,
  Tag,
} from "../contracts/orbitone.v2";

function toOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  return null;
}

export function mapUser(row: {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  organization_id?: string | null;
  is_billing_contact?: boolean;
  plan?: string;
  created_at?: Date;
  updated_at?: Date;
}): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: (row.role as User["role"]) ?? "freelancer",
    organizationId: row.organization_id ?? null,
    isBillingContact: row.is_billing_contact ?? false,
    plan: (row.plan as User["plan"]) ?? "free",
    createdAt: row.created_at ? row.created_at.toISOString() : "",
    updatedAt: row.updated_at ? row.updated_at.toISOString() : "",
  };
}

export function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    slug: row.slug as string,
    type: (row.type as Profile["type"]) ?? "personal",
    fullName: row.full_name as string,
    headline: (row.headline as string | null) ?? null,
    company: (row.company as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    websiteUrl: (row.website_url as string | null) ?? null,
    linkedinUrl: (row.linkedin_url as string | null) ?? null,
    xUrl: (row.x_url as string | null) ?? null,
    department: (row.department as string | null) ?? null,
    jobTitle: (row.job_title as string | null) ?? null,
    isPublished: row.is_published as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export function mapPublicProfile(row: Record<string, unknown>): PublicProfile {
  const profile = mapProfile(row);
  const {
    userId: _userId,
    isPublished: _isPublished,
    updatedAt: _updatedAt,
    ...publicProfile
  } = profile;
  return publicProfile;
}

export function mapOrganization(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    logoUrl: (row.logo_url as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    plan: row.plan as Organization["plan"],
    planStatus: row.plan_status as Organization["planStatus"],
    trialEndsAt: row.trial_ends_at
      ? (row.trial_ends_at as Date).toISOString()
      : null,
    subscriptionRenewalAt: row.subscription_renewal_at
      ? (row.subscription_renewal_at as Date).toISOString()
      : null,
    settings: (row.settings as Record<string, unknown>) ?? {},
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export function mapMeetingType(row: Record<string, unknown>): MeetingType {
  return {
    id: (row.meeting_type_id as string) ?? (row.id as string),
    ownerUserId: row.owner_user_id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    durationMinutes: Number(row.duration_minutes),
    locationType: (row.location_type as MeetingType["locationType"]) ?? "video",
    locationValue: (row.location_value as string | null) ?? null,
    bufferBeforeMinutes: Number(row.buffer_before_minutes ?? 0),
    bufferAfterMinutes: Number(row.buffer_after_minutes ?? 0),
    minNoticeMinutes: Number(row.min_notice_minutes ?? 60),
    bookingWindowDays: Number(row.booking_window_days ?? 30),
    maxBookingsPerDay:
      row.max_bookings_per_day === null ||
      row.max_bookings_per_day === undefined
        ? null
        : Number(row.max_bookings_per_day),
    requiresApproval: (row.requires_approval as boolean) ?? false,
    isActive: (row.is_active as boolean) ?? true,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export function mapAvailabilityRule(
  row: Record<string, unknown>,
): AvailabilityRule {
  return {
    id: row.id as string,
    ownerUserId: row.owner_user_id as string,
    dayOfWeek: Number(row.day_of_week),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    timezone: String(row.timezone),
    isActive: (row.is_active as boolean) ?? true,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export function mapAvailabilityException(
  row: Record<string, unknown>,
): AvailabilityException {
  return {
    id: row.id as string,
    ownerUserId: row.owner_user_id as string,
    exceptionDate: String(row.exception_date).slice(0, 10),
    startTime: toOptionalString(row.start_time),
    endTime: toOptionalString(row.end_time),
    timezone: String(row.timezone),
    isAvailable: (row.is_available as boolean) ?? false,
    reason: (row.reason as string | null) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export function mapBookingGuest(row: Record<string, unknown>): BookingGuest {
  return {
    id: row.guest_id as string,
    name: row.guest_name as string,
    email: row.guest_email as string,
    company: (row.guest_company as string | null) ?? null,
    message: (row.guest_message as string | null) ?? null,
    createdAt: (row.guest_created_at as Date).toISOString(),
  };
}

export function mapBooking(row: Record<string, unknown>): Booking {
  return {
    id: row.id as string,
    ownerUserId: row.owner_user_id as string,
    meetingTypeId: row.meeting_type_id as string,
    guestId: row.guest_id as string,
    customerId: (row.customer_id as string | null) ?? null,
    source: (row.source as Booking["source"]) ?? "profile",
    status: (row.status as Booking["status"]) ?? "confirmed",
    startAt: (row.start_at as Date).toISOString(),
    endAt: (row.end_at as Date).toISOString(),
    timezone: String(row.timezone),
    cancellationReason: (row.cancellation_reason as string | null) ?? null,
    rescheduledFromBookingId:
      (row.rescheduled_from_booking_id as string | null) ?? null,
    externalProvider:
      (row.external_provider as Booking["externalProvider"]) ?? null,
    externalEventId: (row.external_event_id as string | null) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    meetingType: "meeting_type_slug" in row ? mapMeetingType(row) : undefined,
    guest: "guest_id" in row ? mapBookingGuest(row) : undefined,
  };
}

export function mapBookingWithJoins(row: Record<string, unknown>): Booking {
  return {
    ...mapBooking(row),
    meetingType: mapMeetingType(row),
    guest: mapBookingGuest(row),
  };
}

export function buildPublicBookingProfile(
  profile: PublicProfile,
  meetingTypes: MeetingType[],
): PublicBookingProfile {
  return { profile, meetingTypes };
}

export function buildBookingSlot(slot: {
  startAt: string;
  endAt: string;
  timezone: string;
  available: boolean;
}): BookingSlot {
  return slot;
}

export function buildAuthMe(input: {
  user: User;
  profile: Profile | null;
  organization: Organization | null;
}): AuthMe {
  return input;
}

export function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string | null) ?? null,
    assignedToUserId: (row.assigned_to_user_id as string | null) ?? null,
    fullName: row.full_name as string,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    company: (row.company as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    lifecycleStage:
      (row.lifecycle_stage as Customer["lifecycleStage"]) ?? "new",
    priority: (row.priority as Customer["priority"]) ?? "medium",
    nextStep: (row.next_step as string | null) ?? null,
    lastContactedAt: row.last_contacted_at
      ? (row.last_contacted_at as Date).toISOString()
      : null,
    source: (row.source as Customer["source"]) ?? "manual",
    sourceProfileId: (row.source_profile_id as string | null) ?? null,
    sourceUserId: (row.source_user_id as string | null) ?? null,
    sourceBookingId: (row.source_booking_id as string | null) ?? null,
    valueAmount: row.value_amount ? Number(row.value_amount) : null,
    valueCurrency: (row.value_currency as string) ?? "LKR",
    expectedCloseDate: row.expected_close_date
      ? (row.expected_close_date as Date).toISOString().split("T")[0]
      : null,
    outcome: (row.outcome as Customer["outcome"]) ?? "in_progress",
    closedAt: row.closed_at ? (row.closed_at as Date).toISOString() : null,
    closedReason: (row.closed_reason as string | null) ?? null,
    accountId: (row.account_id as string | null) ?? null,
    pipelineId: (row.pipeline_id as string | null) ?? null,
    pipelineStageId: (row.pipeline_stage_id as string | null) ?? null,
    customFieldValues: [],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export function mapCustomerStageHistory(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    fromStage: (row.from_stage as Customer["lifecycleStage"] | null) ?? null,
    toStage: (row.to_stage as Customer["lifecycleStage"]) ?? "new",
    note: (row.note as string | null) ?? null,
    changedByUserId: row.changed_by_user_id as string,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export function mapCustomerActivity(
  row: Record<string, unknown>,
): CustomerActivity {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    createdByUserId: row.created_by_user_id as string,
    activityTypeDefinitionId:
      (row.activity_type_definition_id as string | null) ?? null,
    type: (row.type as CustomerActivity["type"]) ?? "other",
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    occurredAt: (row.occurred_at as Date).toISOString(),
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export function mapCustomerFollowUp(
  row: Record<string, unknown>,
): CustomerFollowUp {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    createdByUserId: row.created_by_user_id as string,
    title: row.title as string,
    dueAt: (row.due_at as Date).toISOString(),
    completedAt: row.completed_at
      ? (row.completed_at as Date).toISOString()
      : null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export function mapCustomerRating(
  row: Record<string, unknown>,
): CustomerRating {
  return {
    id: row.id as string,
    bookingId: (row.booking_id as string | null) ?? null,
    customerId: (row.customer_id as string | null) ?? null,
    profileId: row.profile_id as string,
    rating: Number(row.rating),
    review: (row.review as string | null) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export function mapTag(row: Record<string, unknown>): Tag {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string | null) ?? null,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    name: row.name as string,
    color: (row.color as string) ?? "#047857",
    createdAt: (row.created_at as Date).toISOString(),
  };
}
