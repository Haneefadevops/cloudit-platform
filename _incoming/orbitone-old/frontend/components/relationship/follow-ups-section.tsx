"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FollowUp } from "@/lib/contracts";
import { Check, Plus, Trash2, Calendar, RotateCcw } from "lucide-react";

interface FollowUpsSectionProps {
  followUps: FollowUp[];
  onCreate: (title: string, dueAt: string) => Promise<void>;
  onComplete: (followUpId: string, completed: boolean) => Promise<void>;
  onDelete: (followUpId: string) => Promise<void>;
}

export function FollowUpsSection({
  followUps,
  onCreate,
  onComplete,
  onDelete,
}: FollowUpsSectionProps) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueAt) return;
    setCreating(true);
    await onCreate(title.trim(), new Date(dueAt).toISOString());
    setTitle("");
    setDueAt("");
    setCreating(false);
  }

  async function handleToggle(followUp: FollowUp) {
    setCompletingId(followUp.id);
    const isComplete = followUp.completedAt !== null;
    await onComplete(followUp.id, !isComplete);
    setCompletingId(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }

  const sorted = [...followUps].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Follow-ups</h3>

      <form onSubmit={handleCreate} className="space-y-2 rounded-2xl border border-border bg-surface p-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you need to follow up on?"
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="flex h-11 w-full flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 pl-9 text-base text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary"
            />
          </div>
          <Button type="submit" isLoading={creating} size="sm">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </form>

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface py-8 text-center text-sm text-muted">
          No follow-ups yet. Schedule the next step with this connection.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((followUp) => {
            const isComplete = followUp.completedAt !== null;
            const isOverdue =
              !isComplete && new Date(followUp.dueAt) < new Date();

            return (
              <li
                key={followUp.id}
                className={[
                  "flex items-start justify-between gap-3 rounded-2xl border bg-surface p-4 transition-shadow hover:shadow-card",
                  isComplete
                    ? "border-border opacity-60"
                    : isOverdue
                    ? "border-error/30 bg-error-subtle/30"
                    : "border-border",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggle(followUp)}
                    disabled={completingId === followUp.id}
                    className={[
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                      isComplete
                        ? "border-success bg-success text-white"
                        : "border-border hover:border-secondary",
                    ].join(" ")}
                  >
                    {isComplete && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div>
                    <p
                      className={[
                        "text-sm font-medium text-foreground",
                        isComplete && "line-through",
                      ].join(" ")}
                    >
                      {followUp.title}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Due {new Date(followUp.dueAt).toLocaleString()}
                      {isOverdue && (
                        <span className="ml-2 font-medium text-error">
                          Overdue
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(followUp)}
                    isLoading={completingId === followUp.id}
                    className="text-muted hover:text-foreground"
                  >
                    {isComplete ? (
                      <RotateCcw className="h-4 w-4" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {isComplete ? "Reopen" : "Complete"}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(followUp.id)}
                    isLoading={deletingId === followUp.id}
                    className="text-error hover:bg-error-subtle hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete follow-up</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
