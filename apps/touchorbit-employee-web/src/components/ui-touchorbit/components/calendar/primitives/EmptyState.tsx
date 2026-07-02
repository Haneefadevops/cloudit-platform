"use client";

import React from "react";
import { cn } from "../../../lib/utils";
import { CalendarX } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "Nothing scheduled",
  description = "There are no events for this view.",
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        "border-2 border-dashed border-[#F1F0F4] rounded-[32px] bg-[#F8F7F9]/50",
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#F1F0F4] flex items-center justify-center mb-4 text-[#D1D5DB]">
        {icon || <CalendarX size={24} strokeWidth={2} />}
      </div>
      <h3 className="text-sm font-black text-[#9CA3AF] mb-1">{title}</h3>
      <p className="text-xs font-medium text-[#D1D5DB] max-w-[200px]">{description}</p>
    </div>
  );
}
