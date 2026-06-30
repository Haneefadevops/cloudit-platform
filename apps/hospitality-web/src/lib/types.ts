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

export interface TaxBreakdownItem {
  name: string;
  rate: number;
  amount: number;
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

export type ReportType = 'occupancy' | 'revenue' | 'guests' | 'reservations';
