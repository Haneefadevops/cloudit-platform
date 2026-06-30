"use client";

import React from "react";
import { cn } from "../../lib/utils";
import { EventCardData } from "./EventCard";
import { PillBadge, EventType } from "./primitives/PillBadge";
import { X, Clock, MapPin, Users, Video, FileText, CalendarDays, Copy } from "lucide-react";

interface EventDetailPanelProps {
  event: EventCardData | null;
  onClose: () => void;
  onEdit?: (event: EventCardData) => void;
  onDelete?: (event: EventCardData) => void;
  onDuplicate?: (event: EventCardData) => void;
  className?: string;
}

export function EventDetailPanel({ event, onClose, onEdit, onDelete, onDuplicate, className }: EventDetailPanelProps) {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (event) {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [event]);

  if (!mounted || !event) return null;

  const timeText = event.allDay
    ? "All day"
    : event.startAt
    ? `${new Date(event.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}${event.endAt ? ` – ${new Date(event.endAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}` : ""}`
    : "";

  const dateText = event.startAt
    ? new Date(event.startAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-end",
        "transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0"
      )}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div className="absolute inset-0 bg-[#1A1727]/60 backdrop-blur-sm" />

      <div
        className={cn(
          "relative h-full w-full max-w-[420px] bg-white shadow-2xl border-l border-[#F1F0F4] flex flex-col",
          "transition-transform duration-500 ease-out",
          visible ? "translate-x-0" : "translate-x-full",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#F1F0F4] bg-[#F8F7F9]/50 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <PillBadge eventType={event.type as EventType}>{event.type.replace("_", " ")}</PillBadge>
              {event.status && event.status !== "confirmed" && (
                <PillBadge status={event.status}>{event.status}</PillBadge>
              )}
            </div>
            <h2 className="text-lg font-black text-[#1A1727] tracking-tight leading-snug">{event.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2.5 bg-white border border-[#F1F0F4] rounded-full text-[#9CA3AF] hover:text-red-500 transition-all hover:rotate-90 shadow-sm"
            aria-label="Close panel"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {event.description && (
            <div>
              <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Description</div>
              <p className="text-sm text-[#6B7280] leading-relaxed">{event.description}</p>
            </div>
          )}

          <div className="space-y-3">
            {dateText && (
              <div className="flex items-center gap-3 text-sm text-[#374151]">
                <div className="w-8 h-8 rounded-xl bg-[#F8F7F9] border border-[#F1F0F4] flex items-center justify-center text-[#9CA3AF]">
                  <CalendarDays size={14} />
                </div>
                <span className="font-bold">{dateText}</span>
              </div>
            )}
            {timeText && (
              <div className="flex items-center gap-3 text-sm text-[#374151]">
                <div className="w-8 h-8 rounded-xl bg-[#F8F7F9] border border-[#F1F0F4] flex items-center justify-center text-[#9CA3AF]">
                  <Clock size={14} />
                </div>
                <span className="font-bold">{timeText}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-3 text-sm text-[#374151]">
                <div className="w-8 h-8 rounded-xl bg-[#F8F7F9] border border-[#F1F0F4] flex items-center justify-center text-[#9CA3AF]">
                  <MapPin size={14} />
                </div>
                <span className="font-bold">{event.location}</span>
              </div>
            )}
            {!!event.attendeeCount && (
              <div className="flex items-center gap-3 text-sm text-[#374151]">
                <div className="w-8 h-8 rounded-xl bg-[#F8F7F9] border border-[#F1F0F4] flex items-center justify-center text-[#9CA3AF]">
                  <Users size={14} />
                </div>
                <span className="font-bold">{event.attendeeCount} attendees</span>
              </div>
            )}
          </div>

          {event.meetingUrl && (
            <a
              href={event.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest",
                "bg-[#534AB7] text-white shadow-lg shadow-purple-900/20",
                "hover:bg-[#1E1854] active:scale-[0.98] transition-all"
              )}
            >
              <Video size={16} strokeWidth={2.5} />
              Join Meeting
            </a>
          )}
        </div>

        {/* Footer actions */}
        {(onEdit || onDelete || onDuplicate) && (
          <div className="p-6 border-t border-[#F1F0F4] bg-[#F8F7F9]/50 flex gap-3 flex-wrap">
            {onDuplicate && (
              <button
                onClick={() => onDuplicate(event)}
                className="flex-1 min-w-[80px] py-3 rounded-xl text-xs font-black uppercase tracking-widest text-emerald-700 bg-white border border-emerald-100 hover:bg-emerald-50 transition-all flex items-center justify-center gap-1.5"
              >
                <Copy size={13} /> Duplicate
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(event)}
                className="flex-1 min-w-[80px] py-3 rounded-xl text-xs font-black uppercase tracking-widest text-[#534AB7] bg-white border border-[#F1F0F4] hover:bg-[#F8F7F9] transition-all"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(event)}
                className="flex-1 min-w-[80px] py-3 rounded-xl text-xs font-black uppercase tracking-widest text-red-600 bg-white border border-red-100 hover:bg-red-50 transition-all"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
