export interface Property {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  publicSlug?: string;
  taxId?: string;
  registrationNumber?: string;
  sltdaNumber?: string;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  _count?: {
    rooms: number;
    roomTypes: number;
  };
}

export interface RoomType {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  maxOccupancy: number;
  amenities?: string[];
  propertyId: string;
  seasonalRates?: SeasonalRate[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    rooms: number;
  };
}

export interface PublicAvailabilityRoomType {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  maxOccupancy: number;
  amenities?: string[];
  availableRooms?: number;
  totalRooms: number;
  seasonalRates: {
    name: string;
    startDate: string;
    endDate: string;
    price: number;
    minimumStay: number;
  }[];
}

export interface PublicAvailabilityResult {
  property: Pick<
    Property,
    "id" | "name" | "publicSlug" | "address" | "phone" | "email" | "settings"
  >;
  search: {
    checkInDate?: string;
    checkOutDate?: string;
  };
  roomTypes: PublicAvailabilityRoomType[];
}

export interface PublicBookingConfirmation {
  reservation: {
    id: string;
    reservationNumber: string;
    checkInDate: string;
    checkOutDate: string;
    totalAmount: number;
    status: ReservationStatus;
  };
  guest: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  property: {
    name: string;
    publicSlug?: string;
    email?: string;
    phone?: string;
  };
  guestPortalUrl: string;
  selfCheckInUrl: string;
  paymentMethod: PaymentMethod;
}

export interface PublicBookingPortal {
  token: string;
  expiresAt: string;
  submittedAt?: string;
  links: {
    selfCheckIn: string;
    selfCheckOut: string;
  };
  reservation: {
    id: string;
    reservationNumber: string;
    checkInDate: string;
    checkOutDate: string;
    status: ReservationStatus;
    adults: number;
    children: number;
    totalAmount: number;
    paidAmount: number;
    balance: number;
  };
  property: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    publicSlug?: string;
  };
  room: {
    roomNumber: string;
    roomType: string;
    maxOccupancy: number;
  };
  guest: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    localPhone?: string;
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;
    status: InvoiceStatus;
  } | null;
}

export interface SeasonalRate {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  price: number;
  minimumStay: number;
  isActive: boolean;
  roomTypeId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'cleaning';
export type HousekeepingTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type HousekeepingTaskType = 'checkout_clean' | 'stayover_clean' | 'deep_clean' | 'maintenance_followup';

export interface Room {
  id: string;
  roomNumber: string;
  floor?: string;
  status: RoomStatus;
  propertyId: string;
  roomTypeId: string;
  property?: Property;
  roomType?: RoomType;
  createdAt: string;
  updatedAt: string;
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  localPhone?: string;
  idNumber?: string;
  nicNumber?: string;
  passportNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  isForeignGuest?: boolean;
  nationality?: string;
  address?: string;
  notes?: string;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

export interface Reservation {
  id: string;
  reservationNumber: string;
  propertyId: string;
  roomId: string;
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  status: ReservationStatus;
  totalAmount: number;
  paidAmount: number;
  source: string;
  notes?: string;
  guest?: Guest;
  room?: Room;
  property?: Property;
  createdAt: string;
}

export interface ReservationQuote {
  roomId: string;
  roomTypeId: string;
  nights: number;
  currency: string;
  totalAmount: number;
  averageNightlyRate: number;
  lines: {
    date: string;
    roomTypeId: string;
    rateName: string;
    amount: number;
  }[];
}

export type IntegrationProvider = 'channel_manager' | 'pos';
export type IntegrationStatus = 'active' | 'inactive' | 'error';
export type IntegrationSyncStatus = 'pending' | 'success' | 'failed';

export interface IntegrationSyncLog {
  id: string;
  direction: 'pull' | 'push' | 'bidirectional';
  status: IntegrationSyncStatus;
  recordsPulled: number;
  recordsPushed: number;
  summary?: string;
  errorMessage?: string;
  payload?: Record<string, any>;
  connectionId: string;
  organizationId: string;
  createdAt: string;
}

export interface IntegrationConnection {
  id: string;
  provider: IntegrationProvider;
  name: string;
  status: IntegrationStatus;
  endpointUrl?: string;
  config?: Record<string, any>;
  lastSyncAt?: string;
  propertyId?: string;
  property?: Property;
  organizationId: string;
  syncLogs?: IntegrationSyncLog[];
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationSummary {
  summary: {
    totalConnections: number;
    activeConnections: number;
    channelManagers: number;
    posSystems: number;
  };
  connectedChannels: {
    id: string;
    name: string;
    channel: string;
    status: IntegrationStatus;
    propertyName: string;
    lastSyncAt?: string;
  }[];
  posConnections: {
    id: string;
    name: string;
    system: string;
    outletId?: string;
    status: IntegrationStatus;
    propertyName: string;
    lastSyncAt?: string;
  }[];
  recentLogs: {
    id: string;
    provider: IntegrationProvider;
    connectionName: string;
    direction: 'pull' | 'push' | 'bidirectional';
    status: IntegrationSyncStatus;
    recordsPulled: number;
    recordsPushed: number;
    summary?: string;
    createdAt: string;
  }[];
}

export interface GuestCheckInLink {
  id: string;
  token: string;
  expiresAt: string;
  url: string;
  reservation: PublicCheckInReservation;
}

export interface PublicCheckInReservation {
  id: string;
  reservationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  property: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  room: {
    roomNumber: string;
    roomType?: string;
  };
  guest: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    localPhone?: string;
    nicNumber?: string;
    passportNumber?: string;
    nationality?: string;
    address?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  };
}

export interface PublicCheckInSession {
  token: string;
  expiresAt: string;
  submittedAt?: string;
  reservation: PublicCheckInReservation;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CalendarDayReservation {
  id: string;
  reservationNumber: string;
  guestName: string;
  roomNumber: string;
  status: ReservationStatus;
  type: 'check-in' | 'check-out';
}

export interface CalendarDay {
  date: string;
  checkIns: number;
  checkOuts: number;
  reservations: CalendarDayReservation[];
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'payhere' | 'stripe';
export type PaymentProviderStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';

export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  providerStatus: PaymentProviderStatus;
  providerRef?: string;
  transactionDate: string;
  notes?: string;
  metadata?: Record<string, any>;
  invoiceId: string;
  reservationId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HousekeepingTask {
  id: string;
  type: HousekeepingTaskType;
  status: HousekeepingTaskStatus;
  priority: number;
  assignedTo?: string;
  dueDate?: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  roomId: string;
  room?: Room;
  propertyId: string;
  property?: Property;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentIntent {
  provider: 'payhere' | 'stripe';
  providerRef: string;
  amount: number;
  currency: string;
  checkoutUrl?: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;
  };
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
}

export interface TaxBreakdownItem {
  name: string;
  rate: number;
  amount: number;
  taxableBase?: number;
}

export type TaxRateType = 'percentage' | 'fixed';

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
  type: TaxRateType;
  isActive: boolean;
  isDefault: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceReservationInfo {
  id: string;
  reservationNumber: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  taxBreakdown: TaxBreakdownItem[];
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  notes?: string;
  propertyId: string;
  reservationId: string;
  guestId: string;
  property?: Property;
  guest?: Guest;
  reservation?: InvoiceReservationInfo;
  payments?: Payment[];
  createdAt: string;
}

export interface InvoicePreview {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  property: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    registrationNumber?: string;
    sltdaNumber?: string;
  };
  guest: {
    name: string;
    email?: string;
    phone?: string;
    localPhone?: string;
    nicNumber?: string;
    passportNumber?: string;
    address?: string;
  };
  reservation: InvoiceReservationInfo & {
    room?: Room & { roomType?: RoomType };
    guest?: Guest;
  };
  lineItems: { description: string; amount: number }[];
  subtotal: number;
  taxBreakdown: TaxBreakdownItem[];
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  payments?: Payment[];
  notes?: string;
}

export interface OccupancyReport {
  summary: {
    totalRooms: number;
    occupiedRooms: number;
    occupancyRate: number;
    revenue: number;
  };
  byDate: {
    date: string;
    occupiedRooms: number;
    revenue: number;
  }[];
}

export interface RevenueReport {
  summary: {
    totalRevenue: number;
    totalSubtotal: number;
    totalPaid: number;
    outstanding: number;
  };
  taxBreakdown: TaxBreakdownItem[];
  byRoomType: { name: string; amount: number }[];
  byStatus: { status: string; amount: number }[];
}

export interface RevenueManagementReport {
  summary: {
    totalRooms: number;
    roomNightsAvailable: number;
    occupiedRoomNights: number;
    occupancyRate: number;
    adr: number;
    revPar: number;
    pickup: number;
    revenue: number;
  };
  byRoomType: {
    roomTypeId: string;
    name: string;
    rooms: number;
    occupancyRate: number;
    currentRate: number;
    suggestedRate: number;
    rateChange: number;
    recommendation: string;
  }[];
}

export interface GuestReport {
  summary: {
    totalGuests: number;
    uniqueGuests: number;
    newGuests: number;
    returningGuests: number;
  };
  topNationalities: { nationality: string; count: number }[];
}

export interface ReservationReport {
  summary: {
    totalReservations: number;
    totalRevenue: number;
    cancellationRate: number;
    noShowRate: number;
  };
  byStatus: { status: string; count: number }[];
  bySource: { source: string; count: number }[];
}

export interface DashboardOverview {
  date: string;
  summary: {
    checkIns: number;
    checkOuts: number;
    availableRooms: number;
    occupiedRooms: number;
    totalRooms: number;
    occupancyRate: number;
    revenue: number;
  };
  checkIns: Reservation[];
  checkOuts: Reservation[];
}

export interface GuestSourceReport {
  summary: {
    totalReservations: number;
  };
  bySource: {
    source: string;
    count: number;
    revenue: number;
    share: number;
  }[];
}

export interface TaxSummaryReport {
  summary: {
    invoiceCount: number;
    totalTax: number;
  };
  byTax: {
    name: string;
    rate: number;
    taxableBase: number;
    amount: number;
    invoiceCount: number;
  }[];
}

export interface TdlReport {
  summary: {
    invoiceCount: number;
    taxableRevenue: number;
    tdlAmount: number;
  };
  byInvoice: {
    invoiceNumber: string;
    issueDate: string;
    taxableRevenue: number;
    tdlRate: number;
    tdlAmount: number;
    totalAmount: number;
  }[];
}

export type ReportType =
  | 'occupancy'
  | 'revenue'
  | 'revenue-management'
  | 'guests'
  | 'guest-sources'
  | 'reservations'
  | 'tax-summary'
  | 'tdl';
