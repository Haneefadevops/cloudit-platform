export interface Property {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
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
  idNumber?: string;
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
