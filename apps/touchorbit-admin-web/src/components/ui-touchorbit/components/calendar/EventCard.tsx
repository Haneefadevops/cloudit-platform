"use client";

import React from "react";
import { cn } from "../../lib/utils";
import { PillBadge, EventType } from "./primitives/PillBadge";
import { Clock, MapPin, Users, Video } from "lucide-react";

export interface EventCardData {
  id: string;
  title: string;
  type: EventType;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  location?: string;
  meetingUrl?: string;
  attendeeCount?: number;
  status?: "draft" | "confirmed" | "cancelled" | "rescheduled";
  description?: string;
}

interface EventCardProps {
  event: EventCardData;
  onClick?: (event: EventCardData) => void;
  className?: string;
  compact?: boolean;
}

const typeBorderColors: Record<EventType, string> = {
  shift:        "border-l-emerald-400",
  leave:        "border-l-blue-400",
  holiday:      "border-l-red-400",
  training:     "border-l-orange-400",
  meeting:      "border-l-purple-400",
  company_event:"border-l-violet-400",
  task:         "border-l-slate-400",
  birthday:     "border-l-pink-400",
};

export function EventCard({ event, onClick, className, compact }: EventCardProps) {
  const timeText = event.allDay
    ? "All day"
    : event.startAt
    ? `${new Date(event.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}${event.endAt ? ` – ${new Date(event.endAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}` : ""}`
    : "";

  if (compact) {
    return (
      <button
        onClick={() => onClick?.(event)}
        className={cn(
          "w-full text-left px-3 py-2 rounded-xl border-l-4 bg-white border border-[#F1F0F4]",
          "hover:shadow-md hover:shadow-purple-900/5 transition-all duration-200 active:scale-[0.98]",
          typeBorderColors[event.type],
          className
        )}
      >
        <div className="flex items-center gap-2">
          <PillBadge eventType={event.type} className="text-[8px] px-1.5">
            {event.type.replace("_", " ")}
          </PillBadge>
          <span className="text-xs font-bold text-[#1A1727] truncate">{event.title}</span>
        </div>
        {timeText && (
          <div className="flex items-center gap-1 mt-1 text-[10px] font-black text-[#9CA3AF] uppercase tracking-tighter">
            <Clock size={10} />
            {timeText}
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => onClick?.(event)}
      className={cn(
        "w-full text-left p-4 rounded-[20px] border-l-4 bg-white border border-[#F1F0F4]",
        "hover:shadow-lg hover:shadow-purple-900/5 transition-all duration-200 active:scale-[0.98]",
        typeBorderColors[event.type],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <PillBadge eventType={event.type}>{event.type.replace("_", " ")}</PillBadge>
            {event.status && event.status !== "confirmed" && (
              <PillBadge status={event.status}>{event.status}</PillBadge>
            )}
          </div>
          <h4 className="text-sm font-black text-[#1A1727] truncate">{event.title}</h4>
          {event.description && (
            <p className="text-[11px] text-[#6B7280] mt-1 line-clamp-2">{event.description}</p>
          )}
        </div>
        {event.meetingUrl && (
          <div className="shrink-0 w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-[#534AB7]">
            <Video size={14} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        {timeText && (
          <div className="flex items-center gap-1 text-[10px] font-black text-[#9CA3AF] uppercase tracking-tighter">
            <Clock size={11} />
            {timeText}
          </div>
        )}
        {event.location && (
          <div className="flex items-center gap-1 text-[10px] font-black text-[#9CA3AF] uppercase tracking-tighter">
            <MapPin size={11} />
            {event.location}
          </div>
        )}
        {!!event.attendeeCount && (
          <div className="flex items-center gap-1 text-[10px] font-black text-[#9CA3AF] uppercase tracking-tighter">
            <Users size={11} />
            {event.attendeeCount}
          </div>
        )}
      </div>
    </button>
  );
}
