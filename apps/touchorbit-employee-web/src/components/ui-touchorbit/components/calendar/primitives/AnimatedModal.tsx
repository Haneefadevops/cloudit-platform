"use client";

import React, { useEffect, useState } from "react";
import { cn } from "../../../lib/utils";
import { X } from "lucide-react";

interface AnimatedModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxWidth?: string;
  className?: string;
}

export function AnimatedModal({ open, onClose, children, title, maxWidth = "28rem", className }: AnimatedModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0"
      )}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#1A1727]/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={cn(
          "relative bg-white rounded-[32px] w-full shadow-2xl border border-[#F1F0F4] overflow-hidden",
          "transition-all duration-200 ease-out",
          visible ? "scale-100 opacity-100 translate-y-0" : "scale-[0.96] opacity-0 translate-y-2",
          className
        )}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-8 pt-8 pb-0">
            <h2 className="text-xl font-black text-[#1A1727] tracking-tight">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all rounded-xl hover:bg-[#F8F7F9]"
              aria-label="Close modal"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        )}
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}
