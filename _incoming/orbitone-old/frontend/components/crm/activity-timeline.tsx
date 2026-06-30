"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConnectionActivity, ConnectionActivityType } from "@/lib/contracts";
import { Trash2, Plus, Phone, Mail, MessageSquare, Users, HelpCircle } from "lucide-react";

interface ActivityTimelineProps {
  activities: ConnectionActivity[];
  onCreate: (input: {
    activityType: ConnectionActivityType;
    title: string;
    body: string | null;
    occurredAt: string;
  }) => Promise<void>;
  onDelete: (activityId: string) => Promise<void>;
}

const activityTypes: { value: ConnectionActivityType; label: string; icon: React.ReactNode; gradient: string }[] = [
  { value: "note", label: "Note", icon: <MessageSquare className="h-4 w-4" />, gradient: "from-secondary to-accent-2" },
  { value: "call", label: "Call", icon: <Phone className="h-4 w-4" />, gradient: "from-accent-2 to-accent" },
  { value: "email", label: "Email", icon: <Mail className="h-4 w-4" />, gradient: "from-secondary to-accent" },
  { value: "meeting", label: "Meeting", icon: <Users className="h-4 w-4" />, gradient: "from-accent to-accent-2" },
  { value: "other", label: "Other", icon: <HelpCircle className="h-4 w-4" />, gradient: "from-muted to-muted/70" },
];

export function ActivityTimeline({
  activities,
  onCreate,
  onDelete,
}: ActivityTimelineProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [activityType, setActivityType] = useState<ConnectionActivityType>("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = [...activities].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsCreating(true);
    await onCreate({
      activityType,
      title: title.trim(),
      body: body.trim() || null,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
    });
    setTitle("");
    setBody("");
    setOccurredAt("");
    setIsCreating(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Activity timeline</h3>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap gap-2">
          {activityTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setActivityType(type.value)}
              className={[
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all",
                activityType === type.value
                  ? "border-transparent bg-primary text-white shadow-sm"
                  : "border-border bg-background text-muted hover:bg-surface hover:text-foreground",
              ].join(" ")}
            >
              {type.icon}
              {type.label}
            </button>
          ))}
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Activity title..."
        />
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Details (optional)..."
          className="flex w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary"
        />
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="flex h-11 flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary"
          />
          <Button type="submit" isLoading={isCreating}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </form>

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface py-8 text-center text-sm text-muted">
          No activities yet. Log calls, emails, meetings, and notes to track your follow-through.
        </p>
      ) : (
        <ul className="relative space-y-4 pl-4 before:absolute before:left-0 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
          {sorted.map((activity) => {
            const typeConfig = activityTypes.find((t) => t.value === activity.activityType);
            return (
              <li key={activity.id} className="relative">
                <span
                  className={[
                    "absolute -left-4 top-1.5 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface text-white shadow-sm",
                    typeConfig ? `bg-gradient-to-br ${typeConfig.gradient}` : "bg-muted",
                  ].join(" ")}
                >
                  {typeConfig?.icon}
                </span>
                <div className="rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                          {typeConfig?.label}
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(activity.occurredAt).toLocaleString()}
                        </span>
                      </div>
                      <h4 className="mt-1 font-medium text-foreground">
                        {activity.title}
                      </h4>
                      {activity.body && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                          {activity.body}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(activity.id)}
                      isLoading={deletingId === activity.id}
                      className="shrink-0 text-error hover:bg-error-subtle hover:text-error"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete activity</span>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
