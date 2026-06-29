export const EventTypes = {
  BOOKING_CREATED: "booking.created",
  BOOKING_UPDATED: "booking.updated",
  BOOKING_CANCELLED: "booking.cancelled",
  BOOKING_CHECKED_IN: "booking.checked_in",
  BOOKING_CHECKED_OUT: "booking.checked_out",
  INVOICE_GENERATED: "invoice.generated",
  USER_CREATED: "user.created",
  USER_LOGIN: "user.login",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
