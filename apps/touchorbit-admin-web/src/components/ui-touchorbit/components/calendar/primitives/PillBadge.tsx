"use client";

import React from "react";
import { cn } from "../../../lib/utils";

export type EventType =
  | "shift"
  | "leave"
  | "holiday"
  | "training"
  | "meeting"
  | "company_event"
  | "task"
  | "birthday";

export type StatusType = "draft" | "confirmed" | "cancelled" | "rescheduled" | "pending" | "accepted" | "declined" | "tentative" | "in_progress" | "completed" | "overdue" | "approved" | "rejected";

const eventTypeStyles: Record<EventType, string> = {
  shift:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  leave:       "bg-blue-50 text-blue-700 border-blue-200",
  holiday:     "bg-red-50 text-red-700 border-red-200",
  training:    "bg-orange-50 text-orange-700 border-orange-200",
  meeting:     "bg-purple-50 text-purple-700 border-purple-200",
  company_event:"bg-violet-50 text-violet-700 border-violet-200",
  task:        "bg-slate-50 text-slate-700 border-slate-200",
  birthday:    "bg-pink-50 text-pink-700 border-pink-200",
};

const statusStyles: Record<StatusType, string> = {
  draft:        "bg-gray-100 text-gray-600 border-gray-200",
  confirmed:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled:    "bg-red-50 text-red-700 border-red-200",
  rescheduled:  "bg-amber-50 text-amber-700 border-amber-200",
  pending:      "bg-amber-50 text-amber-700 border-amber-200",
  accepted:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  declined:     "bg-red-50 text-red-700 border-red-200",
  tentative:    "bg-blue-50 text-blue-700 border-blue-200",
  in_progress:  "bg-blue-50 text-blue-700 border-blue-200",
  completed:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue:      "bg-red-50 text-red-700 border-red-200",
  approved:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected:     "bg-red-50 text-red-700 border-red-200",
};

interface PillBadgeProps {
  children: React.ReactNode;
  eventType?: EventType;
  status?: StatusType;
  className?: string;
  pulse?: boolean;
}

export function PillBadge({ children, eventType, status, className, pulse }: PillBadgeProps) {
  const style = eventType ? eventTypeStyles[eventType] : status ? statusStyles[status] : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border",
        "transition-transform duration-150",
        pulse && "animate-pulse",
        style,
        className
      )}
    >
      {children}
    </span>
  );
}

export function EventDot({ type, className }: { type: EventType; className?: string }) {
  const dotColors: Record<EventType, string> = {
    shift:       "bg-emerald-500",
    leave:       "bg-blue-500",
    holiday:     "bg-red-500",
    training:    "bg-orange-500",
    meeting:     "bg-purple-500",
    company_event:"bg-violet-500",
    task:        "bg-slate-500",
    birthday:    "bg-pink-500",
  };
  return (
    <span
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full shrink-0",
        dotColors[type],
        className
      )}
    />
  );
}
