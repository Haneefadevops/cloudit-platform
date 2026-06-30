export interface Property {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
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
  createdAt: string;
  updatedAt: string;
  _count?: {
    rooms: number;
  };
}

export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'cleaning';

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
  | 'guests'
  | 'guest-sources'
  | 'reservations'
  | 'tax-summary'
  | 'tdl';
