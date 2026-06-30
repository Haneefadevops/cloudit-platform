"use client";

import { useMemo } from "react";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import type { BookingSlot } from "@/lib/contracts";
import {
  formatDateLong,
  formatTime,
  toDateKey,
  userTimezone,
} from "./utils";

interface TimeSlotPickerProps {
  slots: BookingSlot[];
  selectedDate: Date | null;
  selectedSlot: BookingSlot | null;
  onSelect: (slot: BookingSlot) => void;
  onClear: () => void;
  timezone?: string;
}

export function TimeSlotPicker({
  slots,
  selectedDate,
  selectedSlot,
  onSelect,
  onClear,
  timezone = userTimezone,
}: TimeSlotPickerProps) {
  const dateSlots = useMemo(() => {
    if (!selectedDate) return [];
    const key = toDateKey(selectedDate, timezone);
    return slots
      .filter((s) => s.available && toDateKey(new Date(s.startAt), timezone) === key)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [slots, selectedDate, timezone]);

  if (!selectedDate) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
        <Clock className="mx-auto h-8 w-8 text-muted" />
        <h3 className="mt-3 font-semibold text-foreground">Pick a date</h3>
        <p className="mt-1 text-sm text-muted">
          Select a day from the calendar to see available times.
        </p>
      </div>
    );
  }

  if (dateSlots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
        <Clock className="mx-auto h-8 w-8 text-muted" />
        <h3 className="mt-3 font-semibold text-foreground">
          No times on {formatDateLong(selectedDate, timezone)}
        </h3>
        <p className="mt-1 text-sm text-muted">
          Try another date or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {formatDateLong(selectedDate, timezone)}
        </h3>
        {selectedSlot && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {dateSlots.map((slot) => {
          const isSelected = selectedSlot?.startAt === slot.startAt;
          const start = new Date(slot.startAt);

          return (
            <button
              key={slot.startAt}
              type="button"
              onClick={() => onSelect(slot)}
              className={[
                "flex items-center justify-center rounded-xl border px-3 py-3 text-sm font-semibold transition-all",
                "focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2",
                isSelected
                  ? "border-secondary bg-secondary text-white shadow-md"
                  : "border-border bg-surface-elevated text-foreground hover:-translate-y-0.5 hover:border-secondary hover:text-secondary hover:shadow-card",
              ].join(" ")}
            >
              {formatTime(start, timezone)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
