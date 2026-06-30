"use client";

import React from "react";
import { cn } from "../../../lib/utils";

interface TimeColumnProps {
  startHour?: number;
  endHour?: number;
  intervalMinutes?: number;
  className?: string;
  renderLabel?: (hour: number, minute: number) => React.ReactNode;
}

export function TimeColumn({
  startHour = 0,
  endHour = 24,
  intervalMinutes = 60,
  className,
  renderLabel,
}: TimeColumnProps) {
  const slots: { hour: number; minute: number }[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += intervalMinutes) {
      slots.push({ hour: h, minute: m });
    }
  }

  return (
    <div className={cn("flex flex-col select-none", className)}>
      {slots.map(({ hour, minute }, i) => (
        <div
          key={i}
          className="flex items-start justify-end pr-3 text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest"
          style={{ height: `${(intervalMinutes / 60) * 4}rem` }}
        >
          {renderLabel ? (
            renderLabel(hour, minute)
          ) : (
            <span>{String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}</span>
          )}
        </div>
      ))}
    </div>
  );
}
