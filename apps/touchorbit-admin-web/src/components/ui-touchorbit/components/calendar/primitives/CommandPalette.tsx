"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "../../../lib/utils";
import { Search, Calendar, Clock, Users, Briefcase, PartyPopper, Gift, GraduationCap } from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}

interface CommandPaletteProps {
  items?: CommandItem[];
  placeholder?: string;
}

export function CommandPalette({ items = [], placeholder = "Search calendar…" }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultItems: CommandItem[] = [
    { id: "today", label: "Jump to today", shortcut: "T", icon: <Calendar size={14} />, onSelect: () => window.dispatchEvent(new CustomEvent("cal:jump-today")) },
    { id: "week", label: "Switch to week view", shortcut: "W", icon: <Clock size={14} />, onSelect: () => window.dispatchEvent(new CustomEvent("cal:set-view", { detail: "week" })) },
    { id: "month", label: "Switch to month view", shortcut: "M", icon: <Calendar size={14} />, onSelect: () => window.dispatchEvent(new CustomEvent("cal:set-view", { detail: "month" })) },
    { id: "day", label: "Switch to day view", shortcut: "D", icon: <Clock size={14} />, onSelect: () => window.dispatchEvent(new CustomEvent("cal:set-view", { detail: "day" })) },
    { id: "roster", label: "Open roster", shortcut: "R", icon: <Users size={14} />, onSelect: () => window.location.href = "/roster" },
    { id: "shifts", label: "Open shifts", shortcut: "S", icon: <Briefcase size={14} />, onSelect: () => window.location.href = "/shifts" },
    { id: "training", label: "Open training", shortcut: "TR", icon: <GraduationCap size={14} />, onSelect: () => window.location.href = "/training" },
    { id: "birthdays", label: "Show birthdays", shortcut: "B", icon: <Gift size={14} />, onSelect: () => window.dispatchEvent(new CustomEvent("cal:filter", { detail: "birthday" })) },
  ];

  const allItems = items.length > 0 ? items : defaultItems;
  const filtered = allItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()));

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((o) => !o);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].onSelect();
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh] p-4"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-[#1A1727]/40 backdrop-blur-sm" />
      <div
        className={cn(
          "relative w-full max-w-lg bg-white rounded-[24px] shadow-2xl border border-[#F1F0F4] overflow-hidden",
          "transition-all duration-200 ease-out scale-100 opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#F1F0F4]">
          <Search size={18} className="text-[#9CA3AF]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm font-bold text-[#1A1727] outline-none placeholder:text-[#D1D5DB]"
            aria-label="Command palette search"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded text-[10px] font-black text-[#9CA3AF]">
            ESC
          </kbd>
        </div>
        <div className="max-h-[320px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[#9CA3AF] font-medium">No results found.</div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors",
                  idx === selectedIndex ? "bg-[#F8F7F9]" : "hover:bg-[#F8F7F9]/50"
                )}
              >
                <span className="text-[#9CA3AF]">{item.icon}</span>
                <span className="flex-1 text-sm font-bold text-[#374151]">{item.label}</span>
                {item.shortcut && (
                  <kbd className="px-1.5 py-0.5 bg-white border border-[#F1F0F4] rounded text-[10px] font-black text-[#9CA3AF]">
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
