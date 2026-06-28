export interface BookingCreatedPayload {
  reservationId: string;
  reservationNumber: string;
  propertyId: string;
  roomId: string;
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  source: string;
  organizationId?: string;
}

export interface BookingUpdatedPayload {
  reservationId: string;
  reservationNumber: string;
  status?: string;
  checkInDate?: string;
  checkOutDate?: string;
  totalAmount?: number;
  organizationId?: string;
}

export interface BookingCancelledPayload {
  reservationId: string;
  reservationNumber: string;
  reason?: string;
  organizationId?: string;
}

export interface BookingCheckedInPayload {
  reservationId: string;
  reservationNumber: string;
  roomId: string;
  guestId: string;
  checkedInAt: string;
  organizationId?: string;
}

export interface BookingCheckedOutPayload {
  reservationId: string;
  reservationNumber: string;
  roomId: string;
  guestId: string;
  checkedOutAt: string;
  finalAmount?: number;
  organizationId?: string;
}

export interface InvoiceGeneratedPayload {
  invoiceId: string;
  invoiceNumber: string;
  reservationId: string;
  guestId: string;
  totalAmount: number;
  organizationId?: string;
}

export interface UserCreatedPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
}

export interface UserLoginPayload {
  userId: string;
  email: string;
  timestamp: string;
}

export type EventPayload =
  | BookingCreatedPayload
  | BookingUpdatedPayload
  | BookingCancelledPayload
  | BookingCheckedInPayload
  | BookingCheckedOutPayload
  | InvoiceGeneratedPayload
  | UserCreatedPayload
  | UserLoginPayload;
