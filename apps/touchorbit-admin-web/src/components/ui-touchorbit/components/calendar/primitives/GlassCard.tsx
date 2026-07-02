"use client";

import React from "react";
import { cn } from "../../../lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
}

export function GlassCard({ children, className, as: Tag = "div", ...props }: GlassCardProps) {
  const Comp = Tag as any;
  return (
    <Comp
      className={cn(
        "relative rounded-[24px] border border-white/20 bg-white/70 backdrop-blur-xl shadow-[var(--cal-shadow-md)]",
        "transition-all duration-300 ease-out",
        "hover:shadow-[var(--cal-shadow-xl)] hover:bg-white/80",
        "dark:bg-gray-900/60 dark:border-white/10",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
