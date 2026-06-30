// OrbitOne API contracts v2
// Scope: digital card → meeting → CRM
// This file is the single source of truth for the redesigned v2 API.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ============================================================
// Plans & billing
// ============================================================

export const FREE_BOOKINGS_PER_WEEK = 3;

export type Plan =
  | "free"
  | "pro_individual"
  | "pro_business_starter"
  | "pro_business_growth"
  | "pro_business_enterprise";

export type PlanStatus = "active" | "trialing" | "past_due" | "cancelled";

export type PlanLimit = {
  maxStaff: number | null; // null means unlimited
  maxBookingsPerWeek: number | null;
  analyticsEnabled: boolean;
  crmEnabled: boolean;
  ratingsEnabled: boolean;
  customBrandingEnabled: boolean;
  maxCustomFields: number | null;
  pipelinesEnabled: boolean;
  maxPipelines: number | null;
  maxActivityTypes: number | null;
  maxTemplates: number | null;
  maxAutomationRules: number | null;
  maxWebhooks: number | null;
  bulkActionsEnabled: boolean;
};

// ============================================================
// Users & auth
// ============================================================

export type UserRole = "freelancer" | "admin" | "staff";

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId: string | null;
  isBillingContact: boolean;
  plan: Plan;
  createdAt: string;
  updatedAt: string;
};

export type AuthMe = {
  user: User;
  profile: Profile | null;
  organization: Organization | null;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
};

// ============================================================
// Organizations
// ============================================================

export type Organization = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  industry: string | null;
  plan: Plan;
  planStatus: PlanStatus;
  trialEndsAt: string | null;
  subscriptionRenewalAt: string | null;
  settings: OrganizationSettings;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationSettings = {
  defaultStaffRole?: UserRole;
  ratingPromptAfterMinutes?: number;
};

export type OrganizationInput = {
  slug: string;
  name: string;
  industry?: string | null;
  logoUrl?: string | null;
};

export type OrganizationMember = {
  user: User;
  profile: Profile | null;
};

export type OrganizationInvite = {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  expiresAt: string;
  createdAt: string;
};

export type InviteStaffInput = {
  email: string;
  role?: UserRole;
  fullName?: string;
};

export type AcceptInviteInput = {
  token: string;
  password: string;
  fullName?: string;
};

// ============================================================
// Profiles
// ============================================================

export type ProfileType = "personal" | "staff";

export type Profile = {
  id: string;
  userId: string;
  slug: string;
  type: ProfileType;
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
  department: string | null;
  jobTitle: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicProfile = Omit<
  Profile,
  "userId" | "isPublished" | "updatedAt"
>;

export type ProfileInput = {
  slug?: string;
  fullName?: string;
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
  department?: string | null;
  jobTitle?: string | null;
  isPublished?: boolean;
};

export type CreateStaffProfileInput = {
  userId?: string; // if null, create user from invite
  fullName: string;
  email: string;
  jobTitle?: string | null;
  department?: string | null;
  slug?: string;
};

// ============================================================
// Analytics
// ============================================================

export type AnalyticsEventType =
  | "profile_view"
  | "qr_scan"
  | "vcard_download"
  | "connection_added"
  | "booking_page_view"
  | "booking_slot_selected"
  | "booking_created"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "rating_submitted"
  | "plan_upgraded";

export type TrackEventInput = {
  profileId: string;
  eventType: AnalyticsEventType;
  visitorId?: string;
  referrer?: string;
  userAgent?: string;
};

export type ProfileMetrics = {
  profileViews: number;
  qrScans: number;
  vcardDownloads: number;
  connectionsAdded: number;
  bookingsCreated: number;
  ratingsAverage: number;
  ratingsCount: number;
};

// ============================================================
// Customers (CRM)
// ============================================================

export type LifecycleStage =
  | "new"
  | "contacted"
  | "qualified"
  | "meeting"
  | "proposal"
  | "customer"
  | "lost"
  | "archived";

export type Priority = "low" | "medium" | "high";

export type CustomerSource = "scan" | "booking" | "manual" | "import";

export type CustomerOutcome = "in_progress" | "won" | "lost" | "nurture";

export type CRMContext = {
  userId: string;
  organizationId: string | null;
};

export type Customer = {
  id: string;
  organizationId: string | null;
  assignedToUserId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  lifecycleStage: LifecycleStage;
  priority: Priority;
  nextStep: string | null;
  lastContactedAt: string | null;
  source: CustomerSource;
  sourceProfileId: string | null;
  sourceUserId: string | null;
  sourceBookingId: string | null;
  accountId: string | null;
  valueAmount: number | null;
  valueCurrency: string;
  expectedCloseDate: string | null;
  outcome: CustomerOutcome;
  closedAt: string | null;
  closedReason: string | null;
  pipelineId: string | null;
  pipelineStageId: string | null;
  customFieldValues: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
};

export type CustomerInput = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
  lifecycleStage?: LifecycleStage;
  priority?: Priority;
  nextStep?: string | null;
  source?: CustomerSource;
  assignedToUserId?: string | null;
  valueAmount?: number | null;
  valueCurrency?: string;
  expectedCloseDate?: string | null;
  outcome?: CustomerOutcome;
  closedReason?: string | null;
  accountId?: string | null;
  pipelineStageId?: string | null;
  customFieldValues?: CustomFieldValue[];
};

export type CustomerLifecycleInput = {
  lifecycleStage: LifecycleStage;
  note?: string | null;
};

export type CustomerAssignInput = {
  assignedToUserId: string;
};

export type CustomerCloseInput = {
  outcome: CustomerOutcome;
  closedReason?: string | null;
};

export type CustomerStageHistory = {
  id: string;
  customerId: string;
  fromStage: LifecycleStage | null;
  toStage: LifecycleStage;
  note: string | null;
  changedByUserId: string;
  createdAt: string;
};

export type CustomerActivityType =
  "note" | "call" | "email" | "meeting" | "sms" | "whatsapp" | "other";

export type CustomerActivity = {
  id: string;
  customerId: string;
  createdByUserId: string;
  activityTypeDefinitionId: string | null;
  type: CustomerActivityType;
  title: string;
  body: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerActivityInput = {
  type: CustomerActivityType;
  activityTypeDefinitionId?: string;
  title: string;
  body?: string | null;
  occurredAt?: string;
};

export type CustomerFollowUp = {
  id: string;
  customerId: string;
  createdByUserId: string;
  title: string;
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerFollowUpInput = {
  title: string;
  dueAt: string;
};

export type CustomerRating = {
  id: string;
  bookingId: string | null;
  customerId: string | null;
  profileId: string;
  rating: number;
  review: string | null;
  createdAt: string;
};

export type SubmitRatingInput = {
  bookingId?: string;
  customerId?: string;
  profileId: string;
  rating: number;
  review?: string | null;
  feedbackToken?: string | null;
};

export type Tag = {
  id: string;
  organizationId: string | null;
  ownerUserId: string | null;
  name: string;
  color: string;
  createdAt: string;
};

export type TagInput = {
  name: string;
  color?: string;
};

export type CustomerRelationship = {
  customer: Customer;
  activities: CustomerActivity[];
  followUps: CustomerFollowUp[];
  tags: Tag[];
};

export type CRMSummary = {
  lifecycle: Record<LifecycleStage, number>;
  highPriority: number;
  openFollowUps: number;
  overdueFollowUps: number;
  totalCustomers: number;
  forecastValue: number;
  forecastCurrency: string;
  staleLeads: number;
  wonCount: number;
  lostCount: number;
  conversionRate: number;
};

export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "single_select"
  | "multi_select"
  | "url"
  | "email";

export type CustomFieldDefinition = {
  id: string;
  organizationId: string | null;
  ownerUserId: string | null;
  name: string;
  key: string;
  type: CustomFieldType;
  options: string[];
  order: number;
  isRequired: boolean;
};

export type CustomFieldInput = {
  name: string;
  key: string;
  type: CustomFieldType;
  options?: string[];
  order?: number;
  isRequired?: boolean;
};

export type CustomFieldValue = {
  definitionId: string;
  value: unknown;
};

export type PipelineStage = {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  color: string | null;
  probability: number | null;
};

export type PipelineStageInput = {
  name: string;
  order?: number | null;
  color?: string | null;
  probability?: number | null;
};

export type Pipeline = {
  id: string;
  organizationId: string | null;
  ownerUserId: string | null;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
};

export type PipelineInput = {
  name: string;
  stages: PipelineStageInput[];
};

export type CustomerStageMoveInput = {
  pipelineStageId: string;
  note?: string | null;
};

export type CustomerPipelineStageHistory = {
  id: string;
  customerId: string;
  fromStageName: string | null;
  toStageName: string;
  note: string | null;
  changedByUserId: string;
  createdAt: string;
};

export type ActivityTypeDefinition = {
  id: string;
  organizationId: string | null;
  ownerUserId: string | null;
  key: string;
  name: string;
  icon: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type ActivityTypeDefinitionInput = {
  key: string;
  name: string;
  icon?: string | null;
  order?: number;
};

export type CRMTemplateType = "activity" | "follow_up" | "email" | "note";

export type CRMTemplate = {
  id: string;
  organizationId: string | null;
  ownerUserId: string | null;
  name: string;
  type: CRMTemplateType;
  subject: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type CRMTemplateInput = {
  name: string;
  type: CRMTemplateType;
  subject?: string | null;
  body: string;
};

export type AutomationTrigger =
  | "customer_created"
  | "stage_changed"
  | "lifecycle_changed"
  | "activity_created"
  | "follow_up_created"
  | "follow_up_completed";

export type AutomationAction = {
  type: "create_follow_up" | "create_activity" | "send_webhook";
  config: Record<string, unknown>;
};

export type AutomationRule = {
  id: string;
  organizationId: string | null;
  ownerUserId: string | null;
  name: string;
  triggerEvent: AutomationTrigger;
  conditions: Record<string, unknown> | null;
  actions: AutomationAction[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRuleInput = {
  name: string;
  triggerEvent: AutomationTrigger;
  conditions?: Record<string, unknown> | null;
  actions: AutomationAction[];
  isActive?: boolean;
};

export type WebhookSubscription = {
  id: string;
  organizationId: string | null;
  ownerUserId: string | null;
  url: string;
  events: string[];
  secret: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WebhookSubscriptionInput = {
  url: string;
  events: string[];
  secret?: string | null;
};

export type WebhookDelivery = {
  id: string;
  subscriptionId: string;
  event: string;
  payload: unknown;
  status: "pending" | "delivered" | "failed";
  responseStatus: number | null;
  attemptedAt: string | null;
  createdAt: string;
};

export type BulkActionType =
  | "delete"
  | "assign"
  | "set_stage"
  | "set_lifecycle"
  | "set_priority"
  | "set_outcome";

export type BulkActionInput = {
  ids: string[];
  action: BulkActionType;
  payload: Record<string, unknown>;
};

export type BulkActionResult = {
  processed: number;
  errors: { id: string; error: string }[];
};

export type DuplicateGroup = {
  canonicalCustomerId: string;
  canonicalName: string;
  customers: {
    id: string;
    fullName: string;
    email: string | null;
    company: string | null;
    reason: string;
  }[];
};

export type CustomerMergeInput = {
  primaryCustomerId: string;
  secondaryCustomerId: string;
};

export type CustomerImportRow = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  lifecycleStage?: LifecycleStage;
  priority?: Priority;
  source?: CustomerSource;
  notes?: string | null;
};

export type CustomerImportResult = {
  created: number;
  updated: number;
  errors: { row: number; error: string }[];
};

// ============================================================
// Documents
// ============================================================

export type DocumentType = "quotation" | "invoice" | "agreement" | "other";

export type DocumentStatus = "draft" | "sent" | "accepted" | "rejected";

export type DocumentData = {
  items?: { description: string; quantity: number; unitPrice: number }[];
  taxRate?: number;
  notes?: string;
  terms?: string;
  body?: string;
  [key: string]: unknown;
};

export type Document = {
  id: string;
  organizationId: string | null;
  customerId: string;
  createdByUserId: string;
  type: DocumentType;
  title: string;
  data: DocumentData;
  fileUrl: string | null;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type DocumentInput = {
  type: DocumentType;
  title: string;
  data?: DocumentData;
};

export type DocumentStatusUpdate = {
  status: DocumentStatus;
};

// ============================================================
// Feedback requests
// ============================================================

export type FeedbackChannel = "email" | "sms" | "whatsapp";

export type FeedbackStatus = "pending" | "sent" | "opened" | "completed";

export type FeedbackRequest = {
  id: string;
  customerId: string;
  bookingId: string | null;
  token: string;
  channel: FeedbackChannel;
  status: FeedbackStatus;
  ratingId: string | null;
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackRequestInput = {
  channel?: FeedbackChannel;
  bookingId?: string;
};

export type FeedbackTokenInfo = {
  customerId: string;
  customerName: string;
  profileId: string;
  bookingId: string | null;
};

// ============================================================
// Business accounts
// ============================================================

export type AccountLifecycleStage =
  "prospect" | "qualified" | "customer" | "churned" | "archived";

export type Account = {
  id: string;
  organizationId: string;
  assignedToUserId: string | null;
  name: string;
  slug: string;
  industry: string | null;
  website: string | null;
  billingAddress: string | null;
  taxId: string | null;
  lifecycleStage: AccountLifecycleStage;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AccountInput = {
  name: string;
  slug?: string;
  industry?: string | null;
  website?: string | null;
  billingAddress?: string | null;
  taxId?: string | null;
  assignedToUserId?: string | null;
  lifecycleStage?: AccountLifecycleStage;
  isPublic?: boolean;
};

export type AccountWithContacts = {
  account: Account;
  contacts: Customer[];
};

export type AccountConnectionStatus = "pending" | "accepted" | "rejected";

export type AccountConnection = {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  status: AccountConnectionStatus;
  createdAt: string;
  updatedAt: string;
  otherAccount: Account;
};

// ============================================================
// Scheduling
// ============================================================

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

export type BookingStatus =
  "pending" | "confirmed" | "cancelled" | "rescheduled";

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
  customerId: string | null;
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
  customer?: Customer;
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
  customerId?: string | null;
};

export type PublicBookingConfirmation = {
  booking: Booking;
  profile: PublicProfile;
  guestTokens?: {
    reschedule: string;
    cancel: string;
  };
};

export type BookingCancelInput = {
  reason?: string;
};

export type BookingRescheduleInput = {
  startAt: string;
  timezone: string;
};

// ============================================================
// Usage & limits
// ============================================================

export type UsageSummary = {
  bookingsThisWeek: number;
  bookingsWeekLimit: number | null;
  staffCount: number;
  staffLimit: number | null;
};

export type AnalyticsSummary = {
  profileMetrics: ProfileMetrics;
  usage: UsageSummary;
};

// ============================================================
// Dashboard
// ============================================================

export type DashboardSummary = {
  profileMetrics: ProfileMetrics;
  crmSummary: CRMSummary | null;
  usage: UsageSummary;
  upcomingBookings: Booking[];
};
