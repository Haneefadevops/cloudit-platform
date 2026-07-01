"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

export type CalendarView = "month" | "week" | "day";

export type UnifiedEventType =
  | "shift"
  | "leave"
  | "holiday"
  | "training"
  | "meeting"
  | "company_event"
  | "task"
  | "birthday";

export interface UnifiedCalendarEvent {
  id: string;
  title: string;
  type: UnifiedEventType;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  description?: string;
  location?: string;
  meetingUrl?: string;
  status?: "draft" | "confirmed" | "cancelled" | "rescheduled";
  source: "calendar_events" | "leave_records" | "holidays" | "training" | "birthdays";
  raw: any;
}

export interface UseCalendarOptions {
  view: CalendarView;
  currentDate: Date;
}

export function useCalendar({ view, currentDate }: UseCalendarOptions) {
  const { organizationId, isLoaded } = useAuth();
  const [events, setEvents] = useState<UnifiedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getRange = useCallback(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    if (view === "week") {
      const day = currentDate.getDay();
      firstDay.setDate(currentDate.getDate() - day);
      lastDay.setDate(firstDay.getDate() + 6);
    } else if (view === "day") {
      firstDay.setTime(currentDate.getTime());
      lastDay.setTime(currentDate.getTime());
    }
    const startStr = firstDay.toISOString().split("T")[0];
    const endStr = lastDay.toISOString().split("T")[0];
    return { startStr, endStr, firstDay, lastDay };
  }, [year, month, view, currentDate]);

  const loadAll = useCallback(async () => {
    if (!organizationId || !isLoaded) return;
    setLoading(true);
    try {
      const { startStr, endStr } = getRange();
      const result = await api.get<UnifiedCalendarEvent[]>(
        `/calendar-events/unified?start=${startStr}&end=${endStr}`,
      );
      if (!result.ok) {
        throw new Error(result.error || "Failed to load calendar data");
      }
      const all = result.data || [];
      all.sort((a, b) => {
        const ad = a.startAt ? new Date(a.startAt).getTime() : 0;
        const bd = b.startAt ? new Date(b.startAt).getTime() : 0;
        return ad - bd;
      });
      setEvents(all);
    } catch (err: any) {
      toast.error("Failed to load calendar data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, isLoaded, getRange]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime removed: poll every 60 seconds as a lightweight substitute.
  useEffect(() => {
    if (!organizationId) return;
    const interval = setInterval(loadAll, 60000);
    return () => clearInterval(interval);
  }, [organizationId, loadAll]);

  return { events, loading, refetch: loadAll };
}
