"use client";

import React from "react";
import { cn } from "../../../lib/utils";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function BottomSheet({ open, onClose, children, className, title }: BottomSheetProps) {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const startY = React.useRef(0);
  const currentY = React.useRef(0);
  const sheetRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
      document.body.style.overflow = "hidden";
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      document.body.style.overflow = "";
      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
      sheetRef.current.style.transition = "none";
    }
  };

  const handleTouchEnd = () => {
    const diff = currentY.current - startY.current;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "";
      sheetRef.current.style.transform = "";
    }
    if (diff > 80) {
      onClose();
    }
  };

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center",
        "transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0"
      )}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div className="absolute inset-0 bg-[#1A1727]/60 backdrop-blur-sm" />

      <div
        ref={sheetRef}
        className={cn(
          "relative w-full max-w-lg bg-white rounded-t-[32px] shadow-2xl flex flex-col max-h-[85vh]",
          "transition-transform duration-300 ease-out",
          visible ? "translate-y-0" : "translate-y-full",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-[#D1D5DB]" />
        </div>

        {/* Optional title */}
        {title && (
          <div className="px-6 pb-3 pt-1">
            <h3 className="text-sm font-black text-[#1A1727] tracking-tight">{title}</h3>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
