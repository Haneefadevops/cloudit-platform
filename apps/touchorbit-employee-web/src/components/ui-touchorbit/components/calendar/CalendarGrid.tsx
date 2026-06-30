"use client";

import React from "react";
import { cn } from "../../lib/utils";

export type CalendarView = "month" | "week" | "day";

interface CalendarGridProps {
  view: CalendarView;
  currentDate: Date;
  children: React.ReactNode;
  className?: string;
}

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_DAYS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarGrid({ view, currentDate, children, className }: CalendarGridProps) {
  const labels = view === "month" ? WEEK_DAYS : WEEK_DAYS_MON;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="grid grid-cols-7 gap-2 mb-3 shrink-0">
        {labels.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-black text-[#D1D5DB] uppercase tracking-[0.2em] py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Body */}
      <div
        className={cn(
          "grid flex-1",
          view === "month" && "grid-cols-7 gap-2 auto-rows-fr",
          view === "week" && "grid-cols-7 gap-1",
          view === "day" && "grid-cols-1"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function useCalendarGrid(view: CalendarView, currentDate: Date) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getMonthDays = React.useCallback(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    return days;
  }, [year, month]);

  const getWeekDays = React.useCallback(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day;
    start.setDate(diff);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const getDayDate = React.useCallback(() => {
    return new Date(currentDate);
  }, [currentDate]);

  if (view === "month") return { cells: getMonthDays(), type: "month" as const };
  if (view === "week") return { cells: getWeekDays(), type: "week" as const };
  return { cells: [getDayDate()], type: "day" as const };
}
