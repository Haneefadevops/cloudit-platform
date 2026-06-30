"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import {
  LayoutDashboard,
  UserCircle,
  Users,
  Settings,
  Search,
  Calendar,
  Clock,
  Home,
  LogIn,
  UserPlus,
  Command,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  section: string;
}

const commands: CommandItem[] = [
  {
    id: "home",
    label: "Home",
    icon: <Home className="h-4 w-4" />,
    href: "/",
    section: "Marketing",
  },
  {
    id: "login",
    label: "Sign in",
    icon: <LogIn className="h-4 w-4" />,
    href: "/login",
    section: "Marketing",
  },
  {
    id: "register",
    label: "Create account",
    icon: <UserPlus className="h-4 w-4" />,
    href: "/login?mode=register",
    section: "Marketing",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    href: "/dashboard",
    section: "Dashboard",
  },
  {
    id: "profile",
    label: "Profile builder",
    icon: <UserCircle className="h-4 w-4" />,
    href: "/dashboard/profile",
    section: "Dashboard",
  },
  {
    id: "discover",
    label: "Discover",
    icon: <Search className="h-4 w-4" />,
    href: "/dashboard/discover",
    section: "Dashboard",
  },
  {
    id: "connections",
    label: "Connections",
    icon: <Users className="h-4 w-4" />,
    href: "/dashboard/connections",
    section: "Dashboard",
  },
  {
    id: "events",
    label: "Events",
    icon: <Calendar className="h-4 w-4" />,
    href: "/dashboard/events",
    section: "Dashboard",
  },
  {
    id: "scheduling",
    label: "Scheduling",
    icon: <Clock className="h-4 w-4" />,
    href: "/dashboard/scheduling",
    section: "Dashboard",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings className="h-4 w-4" />,
    href: "/dashboard/settings",
    section: "Dashboard",
  },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.section.toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const cmd of filtered) {
      const list = map.get(cmd.section) || [];
      list.push(cmd);
      map.set(cmd.section, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          setOpen(false);
          setQuery("");
          setSelectedIndex(0);
          router.push(selected.href);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, filtered, selectedIndex, router]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setSelectedIndex(0);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedIndex(0);
  }

  function handleSelect(item: CommandItem) {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
    router.push(item.href);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Command palette"
      description="Quickly navigate pages. Press Cmd+K to open anytime."
    >
      <div className="-mx-6 -mt-4 border-b border-border bg-surface/50 px-6 py-3">
        <div className="flex items-center gap-3 text-muted">
          <Command className="h-5 w-5 text-secondary" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted focus:outline-none"
            autoFocus
          />
          <kbd className="hidden rounded-lg border border-border bg-surface px-2 py-0.5 text-xs font-medium sm:inline">
            ESC
          </kbd>
        </div>
      </div>

      <div className="-mx-6 max-h-80 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No pages found.
          </p>
        ) : (
          grouped.map(([section, items]) => (
            <div key={section} className="mt-2">
              <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                {section}
              </p>
              {items.map((item) => {
                const flatIndex = filtered.findIndex((c) => c.id === item.id);
                const isSelected = flatIndex === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={[
                      "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm transition-all duration-150",
                      isSelected
                        ? "bg-secondary/10 text-foreground shadow-sm"
                        : "text-muted hover:bg-surface hover:text-foreground",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "transition-colors",
                        isSelected ? "text-secondary" : "text-muted",
                      ].join(" ")}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {isSelected && (
                      <kbd className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-xs font-medium text-muted">
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}
