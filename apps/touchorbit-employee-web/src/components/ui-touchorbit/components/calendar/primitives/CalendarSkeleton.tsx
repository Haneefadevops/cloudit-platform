"use client";

import React from "react";
import { cn } from "../../../lib/utils";

export function CalendarSkeleton({ className, view = 'month' }: { className?: string; view?: 'month' | 'week' | 'day' }) {
  if (view === 'week') {
    return (
      <div className={cn("animate-pulse space-y-4", className)}>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-4 bg-[#F1F0F4] rounded" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-48 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]" />
          ))}
        </div>
      </div>
    );
  }

  if (view === 'day') {
    return (
      <div className={cn("animate-pulse space-y-4", className)}>
        <div className="h-6 bg-[#F1F0F4] rounded w-48 mx-auto" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-[#F8F7F9] rounded-[20px] border border-[#F1F0F4]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("animate-pulse", className)}>
      <div className="grid grid-cols-7 gap-2 mb-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-4 bg-[#F1F0F4] rounded" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "aspect-square rounded-xl bg-[#F8F7F9] border border-[#F1F0F4]",
              i < 7 && "opacity-40"
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function EventListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 bg-[#F8F7F9] rounded-[20px] border border-[#F1F0F4]" />
      ))}
    </div>
  );
}
