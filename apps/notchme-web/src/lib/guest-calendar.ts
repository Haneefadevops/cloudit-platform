import type { GuestManagedBooking } from "./contracts";

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function utcIcs(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash = Math.imul(hash ^ value.charCodeAt(index), 16777619); }
  return (hash >>> 0).toString(36);
}

export function createGuestBookingIcs(booking: GuestManagedBooking) {
  const summary = `${booking.meetingTypeTitle} with ${booking.hostName}`;
  const description = `Booked with ${booking.hostName}. Display timezone: ${booking.timezone}.`;
  const uid = `notchme-${stableId(`${booking.hostName}|${booking.meetingTypeTitle}|${booking.startAt}`)}@notchme`;
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NotchMe//Guest booking//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${utcIcs(new Date().toISOString())}`, `DTSTART:${utcIcs(booking.startAt)}`, `DTEND:${utcIcs(booking.endAt)}`, `SUMMARY:${escapeIcs(summary)}`, `DESCRIPTION:${escapeIcs(description)}`, `STATUS:${booking.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
}

export function downloadGuestBookingIcs(booking: GuestManagedBooking) {
  const blob = new Blob([createGuestBookingIcs(booking)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "notchme-booking.ics"; link.click(); URL.revokeObjectURL(url);
}
