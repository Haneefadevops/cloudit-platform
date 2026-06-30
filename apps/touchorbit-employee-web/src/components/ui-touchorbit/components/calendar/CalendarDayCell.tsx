"use client";

import React from "react";
import { cn } from "../../lib/utils";
import { EventDot, EventType } from "./primitives/PillBadge";

export interface InlineConflictData {
  conflict_id: string;
  conflict_type: string;
  severity: 'high' | 'medium' | 'low';
  employee_name: string;
  source_title: string;
}

export interface InlineRequestData {
  id: string;
  type: 'leave' | 'swap' | 'reschedule' | 'availability';
  employee_name: string;
  title: string;
  status: string;
}

export interface DayEvent {
  id: string;
  type: EventType;
  title: string;
  allDay?: boolean;
}

interface CalendarDayCellProps {
  date: Date;
  isToday: boolean;
  isCurrentMonth?: boolean;
  events: DayEvent[];
  onClick?: (date: Date) => void;
  className?: string;
  children?: React.ReactNode;
  isHoliday?: boolean;
  isPoya?: boolean;
  holidayName?: string;
  conflicts?: InlineConflictData[];
  requests?: InlineRequestData[];
  onConflictClick?: (conflict: InlineConflictData) => void;
  onRequestClick?: (request: InlineRequestData) => void;
  onRequestApprove?: (id: string, type: string) => void;
  onRequestReject?: (id: string, type: string) => void;
  workload?: number; // 0-10+ for heatmap intensity
}

export function CalendarDayCell({
  date,
  isToday,
  isCurrentMonth = true,
  events,
  onClick,
  className,
  children,
  isHoliday = false,
  isPoya = false,
  holidayName,
  conflicts = [],
  requests = [],
  onConflictClick,
  onRequestClick,
  onRequestApprove,
  onRequestReject,
  workload = 0,
}: CalendarDayCellProps) {
  const day = date.getDate();
  const hasEvents = events.length > 0;
  const allDayEvents = events.filter((e) => e.allDay);
  const timedEvents = events.filter((e) => !e.allDay);

  return (
    <div
      onClick={() => onClick?.(date)}
      className={cn(
        "relative flex flex-col border rounded-2xl p-2 cursor-pointer transition-all duration-200",
        "hover:bg-[#F8F7F9] hover:shadow-md hover:shadow-purple-900/5 hover:border-[#E5E3EA]",
        "focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20",
        isToday
          ? "border-[#534AB7] border-2 bg-purple-50/30 shadow-sm"
          : isHoliday
          ? "border-red-300 bg-red-50/30"
          : workload > 0
          ? "border-[#F1F0F4]"
          : "border-[#F1F0F4] bg-white",
        !isCurrentMonth && "opacity-40 bg-[#FAFAFB]",
        className
      )}
      style={
        workload > 0 && !isToday && !isHoliday
          ? {
              backgroundColor: `rgba(83, 74, 183, ${Math.min(workload * 0.06, 0.35)})`,
            }
          : undefined
      }
      tabIndex={0}
      role="button"
      aria-label={`${date.toDateString()}, ${events.length} events`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(date);
        }
      }}
    >
      {/* Day number */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={cn(
            "text-xs font-black w-6 h-6 flex items-center justify-center rounded-full",
            isToday
              ? "bg-[#534AB7] text-white shadow-md shadow-purple-900/20"
              : isHoliday
              ? "bg-red-100 text-red-700"
              : "text-[#374151]"
          )}
        >
          {day}
        </span>
        <div className="flex items-center gap-1">
          {isPoya && (
            <span className="text-[10px]" title={holidayName || 'Poya Day'}>🌕</span>
          )}
          {hasEvents && events.length > 3 && (
            <span className="text-[9px] font-black text-[#9CA3AF]">+{events.length - 3}</span>
          )}
        </div>
      </div>
      {isHoliday && holidayName && (
        <div className="text-[8px] font-black text-red-600 uppercase tracking-tighter truncate mb-1">
          {holidayName}
        </div>
      )}

      {/* Inline conflict cards — mobile: dots only */}
      {conflicts.length > 0 && (
        <div className="flex flex-col gap-0.5 mb-1">
          {/* Desktop: full cards */}
          <div className="hidden sm:flex flex-col gap-0.5">
            {conflicts.slice(0, 2).map((c) => (
              <button
                key={c.conflict_id}
                onClick={(e) => { e.stopPropagation(); onConflictClick?.(c); }}
                className={`flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter truncate transition-all text-left animate-slide-in-left ${
                  c.severity === 'high'
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : c.severity === 'medium'
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
                title={`${c.conflict_type}: ${c.source_title}`}
              >
                <span className={`w-1 h-1 rounded-full shrink-0 ${
                  c.severity === 'high' ? 'bg-red-500' : c.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <span className="truncate">{c.source_title}</span>
              </button>
            ))}
            {conflicts.length > 2 && (
              <span className="text-[8px] font-bold text-red-400 px-1">+{conflicts.length - 2} more</span>
            )}
          </div>
          {/* Mobile: dots only */}
          <div className="flex sm:hidden items-center gap-1">
            {conflicts.map((c) => (
              <span
                key={c.conflict_id}
                className={`w-2 h-2 rounded-full ${
                  c.severity === 'high' ? 'bg-red-500' : c.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`}
                title={`${c.conflict_type}: ${c.source_title}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inline request cards — mobile: dots only */}
      {requests.length > 0 && (
        <div className="flex flex-col gap-0.5 mb-1">
          {/* Desktop: full cards */}
          <div className="hidden sm:flex flex-col gap-0.5">
            {requests.slice(0, 2).map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter truncate border border-dashed border-amber-300 bg-amber-50/60 text-amber-800 animate-slide-in-left"
                title={`${r.type}: ${r.title}`}
              >
                <span className="truncate flex-1">{r.title}</span>
                {onRequestApprove && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRequestApprove(r.id, r.type); }}
                    className="shrink-0 p-0.5 rounded hover:bg-emerald-200/50 text-emerald-700"
                    title="Approve"
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                )}
                {onRequestReject && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRequestReject(r.id, r.type); }}
                    className="shrink-0 p-0.5 rounded hover:bg-red-200/50 text-red-700"
                    title="Reject"
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            ))}
            {requests.length > 2 && (
              <span className="text-[8px] font-bold text-amber-400 px-1">+{requests.length - 2} more</span>
            )}
          </div>
          {/* Mobile: dots only */}
          <div className="flex sm:hidden items-center gap-1">
            {requests.map((r) => (
              <span
                key={r.id}
                className="w-2 h-2 rounded-full bg-amber-400 border border-amber-300"
                title={`${r.type}: ${r.title}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Event dots / mini cards */}
      <div className="flex-1 flex flex-col gap-1 overflow-hidden">
        {allDayEvents.slice(0, 2).map((e) => (
          <div
            key={e.id}
            className={cn(
              "text-[9px] font-black px-1.5 py-0.5 rounded truncate uppercase tracking-tighter",
              "bg-[hsl(var(--cal-" + e.type + ")]/10 text-[hsl(var(--cal-" + e.type + ")]/90)"
            )}
          >
            {e.title}
          </div>
        ))}
        {timedEvents.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto pt-1">
            {timedEvents.slice(0, 5).map((e) => (
              <EventDot key={e.id} type={e.type} />
            ))}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
