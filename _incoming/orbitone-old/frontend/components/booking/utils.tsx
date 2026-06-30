"use client";

import type { MeetingType } from "@/lib/contracts";
import { Video, Phone, MapPin, Link as LinkIcon } from "lucide-react";

export const userTimezone =
  typeof Intl !== "undefined" && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";

export const locationLabels: Record<MeetingType["locationType"], string> = {
  video: "Video call",
  phone: "Phone call",
  in_person: "In person",
  custom: "Custom",
};

export function LocationIcon({
  locationType,
  className = "h-4 w-4",
}: {
  locationType: MeetingType["locationType"];
  className?: string;
}) {
  const Icon =
    {
      video: Video,
      phone: Phone,
      in_person: MapPin,
      custom: LinkIcon,
    }[locationType] || Video;

  return <Icon className={className} />;
}

export function toDateKey(date: Date, timeZone = userTimezone): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

export function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

export function formatDateLong(
  date: Date,
  timeZone = userTimezone
): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  });
}

export function formatTime(date: Date, timeZone = userTimezone): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function getMonthRange(month: Date): { from: string; to: string } {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const startDayOffset = firstDayOfMonth.getDay();
  const gridStart = new Date(year, monthIndex, 1 - startDayOffset);
  gridStart.setHours(0, 0, 0, 0);

  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
  const endDayOffset = 6 - lastDayOfMonth.getDay();
  const gridEnd = new Date(year, monthIndex + 1, 0 + endDayOffset);
  gridEnd.setHours(23, 59, 59, 999);

  return { from: gridStart.toISOString(), to: gridEnd.toISOString() };
}

export function buildCalendarDays(month: Date): Date[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const startOffset = firstDayOfMonth.getDay();

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(year, monthIndex, 1 - startOffset + i));
  }
  return days;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfWeek(date: Date): Date {
  const offset = date.getDay();
  const start = new Date(date);
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocal(value: string): Date {
  return new Date(value);
}
