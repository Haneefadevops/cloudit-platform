"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
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

  const loadCalendarEvents = useCallback(async () => {
    if (!organizationId) return [];
    const { startStr, endStr } = getRange();
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("event_date", startStr)
      .lte("event_date", endStr)
      .order("event_date", { ascending: true });

    if (error) {
      console.error("calendar_events error:", error);
      return [];
    }

    return (data || []).map((e: any): UnifiedCalendarEvent => {
      const typeMap: Record<string, UnifiedEventType> = {
        meeting: "meeting",
        training: "training",
        announcement: "company_event",
        other: "company_event",
      };
      const startAt = e.start_at || (e.event_date && e.start_time ? `${e.event_date}T${e.start_time}` : e.event_date);
      const endAt = e.end_at || (e.event_date && e.end_time ? `${e.event_date}T${e.end_time}` : e.event_date);
      return {
        id: e.id,
        title: e.title,
        type: typeMap[e.event_type] || "company_event",
        startAt,
        endAt,
        allDay: !e.start_time && !e.end_time,
        description: e.description,
        meetingUrl: e.meeting_url,
        status: e.status || "confirmed",
        source: "calendar_events",
        raw: e,
      };
    });
  }, [organizationId, getRange]);

  const loadLeaveEvents = useCallback(async () => {
    if (!organizationId) return [];
    const { startStr, endStr } = getRange();
    const { data, error } = await supabase
      .from("leave_records")
      .select(`id, start_date, end_date, leave_type, employees(first_name, last_name, department)`)
      .eq("organization_id", organizationId)
      .eq("status", "approved")
      .or(`start_date.lte.${endStr},end_date.gte.${startStr}`);

    if (error) {
      console.error("leave_records error:", error);
      return [];
    }

    return (data || []).map((r: any): UnifiedCalendarEvent => {
      const emp = Array.isArray(r.employees) ? r.employees[0] : r.employees;
      return {
        id: `leave-${r.id}`,
        title: `${emp?.first_name || ""} ${emp?.last_name || ""} — ${r.leave_type}`,
        type: "leave",
        startAt: r.start_date,
        endAt: r.end_date,
        allDay: true,
        source: "leave_records",
        raw: r,
      };
    });
  }, [organizationId, getRange]);

  const loadHolidayEvents = useCallback(async () => {
    if (!organizationId) return [];
    const { startStr, endStr } = getRange();
    const { data, error } = await supabase
      .from("holidays")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("date", startStr)
      .lte("date", endStr)
      .order("date", { ascending: true });

    if (error) {
      console.error("holidays error:", error);
      return [];
    }

    return (data || []).map((h: any): UnifiedCalendarEvent => ({
      id: `holiday-${h.id}`,
      title: h.name,
      type: "holiday",
      startAt: h.date,
      endAt: h.date,
      allDay: true,
      description: h.description,
      source: "holidays",
      raw: h,
    }));
  }, [organizationId, getRange]);

  const loadTrainingEvents = useCallback(async () => {
    if (!organizationId) return [];
    const { startStr, endStr } = getRange();

    const [selfRes, assignedRes] = await Promise.all([
      supabase
        .from("employee_training")
        .select(`id, employee_id, training_name, description, start_date, end_date, employees(first_name, last_name)`)
        .eq("organization_id", organizationId)
        .or(`start_date.lte.${endStr},end_date.gte.${startStr}`),
      supabase
        .from("training_assignments")
        .select(`id, employee_id, start_date, end_date, program:training_programs(title, description), employee:employees(first_name, last_name)`)
        .eq("organization_id", organizationId)
        .neq("status", "cancelled")
        .or(`start_date.lte.${endStr},end_date.gte.${startStr}`),
    ]);

    const self = (selfRes.data || []).map((t: any): UnifiedCalendarEvent => {
      const emp = Array.isArray(t.employees) ? t.employees[0] : t.employees;
      return {
        id: `training-${t.id}`,
        title: `${t.training_name} — ${emp?.first_name || ""} ${emp?.last_name || ""}`,
        type: "training",
        startAt: t.start_date,
        endAt: t.end_date,
        allDay: true,
        description: t.description,
        source: "training",
        raw: t,
      };
    });

    const assigned = (assignedRes.data || []).map((t: any): UnifiedCalendarEvent => ({
      id: `training-a-${t.id}`,
      title: `${t.program?.title || "Training"} — ${t.employee?.first_name || ""} ${t.employee?.last_name || ""}`,
      type: "training",
      startAt: t.start_date,
      endAt: t.end_date,
      allDay: true,
      description: t.program?.description,
      source: "training",
      raw: t,
    }));

    return [...self, ...assigned];
  }, [organizationId, getRange]);

  const loadBirthdayEvents = useCallback(async () => {
    if (!organizationId) return [];
    const { startStr, endStr } = getRange();
    try {
      const { data, error } = await supabase.rpc('get_upcoming_birthdays', {
        p_org_id: organizationId,
        p_limit: 100,
      });
      if (error) {
        console.error("birthdays error:", error);
        return [];
      }
      return (data || [])
        .filter((b: any) => {
          const d = new Date(b.next_occurrence).toISOString().split('T')[0];
          return d >= startStr && d <= endStr;
        })
        .map((b: any): UnifiedCalendarEvent => ({
          id: `birthday-${b.employee_id}`,
          title: `${b.employee_name}'s Birthday`,
          type: "birthday",
          startAt: b.next_occurrence,
          endAt: b.next_occurrence,
          allDay: true,
          source: "birthdays",
          raw: b,
        }));
    } catch {
      return [];
    }
  }, [organizationId, getRange]);

  const loadAll = useCallback(async () => {
    if (!organizationId || !isLoaded) return;
    setLoading(true);
    try {
      const [calendar, leave, holidays, training, birthdays] = await Promise.all([
        loadCalendarEvents(),
        loadLeaveEvents(),
        loadHolidayEvents(),
        loadTrainingEvents(),
        loadBirthdayEvents(),
      ]);
      const all = [...calendar, ...leave, ...holidays, ...training, ...birthdays];
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
  }, [organizationId, isLoaded, loadCalendarEvents, loadLeaveEvents, loadHolidayEvents, loadTrainingEvents, loadBirthdayEvents]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime subscription for calendar events
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`calendar-updates-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          loadAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, loadAll]);

  return { events, loading, refetch: loadAll };
}
