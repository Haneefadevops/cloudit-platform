"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildCalendarDays,
  formatMonthYear,
  toDateKey,
} from "./utils";

interface BookingCalendarProps {
  month: Date;
  selectedDate: Date | null;
  availableDates: Set<string>;
  onMonthChange: (nextMonth: Date) => void;
  onSelectDate: (date: Date) => void;
  minDate?: Date;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function BookingCalendar({
  month,
  selectedDate,
  availableDates,
  onMonthChange,
  onSelectDate,
  minDate,
}: BookingCalendarProps) {
  const days = buildCalendarDays(month);
  const todayKey = toDateKey(new Date());
  const minDay = minDate
    ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
    : undefined;

  function previousMonth() {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  }

  function nextMonth() {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">
          {formatMonthYear(month)}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={previousMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted"
          >
            {day}
          </div>
        ))}

        {days.map((date) => {
          const key = toDateKey(date);
          const isCurrentMonth = date.getMonth() === month.getMonth();
          const isToday = key === todayKey;
          const isSelected = selectedDate
            ? key === toDateKey(selectedDate)
            : false;
          const hasSlots = availableDates.has(key);
          const isDisabled = minDay ? date < minDay : false;

          return (
            <button
              key={key + date.getTime()}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDate(date)}
              className={[
                "relative flex h-10 w-full items-center justify-center rounded-xl text-sm font-semibold transition-all",
                "focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2",
                isSelected
                  ? "bg-secondary text-white shadow-md"
                  : isToday
                  ? "border border-secondary/40 text-secondary"
                  : "text-foreground hover:bg-surface-elevated",
                !isCurrentMonth && !isSelected && "text-muted/60",
                isDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
              ].join(" ")}
            >
              {date.getDate()}
              {hasSlots && !isSelected && (
                <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-secondary" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-secondary" />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-4 w-4 rounded-xl border border-secondary/40" />
          Today
        </span>
      </div>
    </div>
  );
}
