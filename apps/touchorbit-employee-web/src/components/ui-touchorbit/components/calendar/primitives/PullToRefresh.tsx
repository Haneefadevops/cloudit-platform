"use client";

import React from "react";
import { cn } from "../../../lib/utils";
import { RefreshCw } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  threshold?: number;
}

export function PullToRefresh({ onRefresh, children, className, threshold = 80 }: PullToRefreshProps) {
  const [pulling, setPulling] = React.useState(false);
  const [pullDistance, setPullDistance] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const startY = React.useRef(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const isAtTop = () => {
    if (!containerRef.current) return false;
    return containerRef.current.scrollTop <= 0;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAtTop()) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pulling) return;
    const y = e.touches[0].clientY;
    const diff = y - startY.current;
    if (diff > 0 && isAtTop()) {
      // Dampen the pull
      const damped = Math.min(diff * 0.5, threshold * 2);
      setPullDistance(damped);
      e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (!pulling) return;
    setPulling(false);
    if (pullDistance >= threshold) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        overscrollBehaviorY: "contain",
      }}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center justify-center overflow-hidden transition-all",
          refreshing ? "h-14" : "h-0"
        )}
        style={{
          height: refreshing ? 56 : Math.max(0, pullDistance),
        }}
      >
        <RefreshCw
          size={20}
          className={cn(
            "text-[#534AB7] transition-all",
            refreshing && "animate-spin"
          )}
        />
      </div>

      {children}
    </div>
  );
}
