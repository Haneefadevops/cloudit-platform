"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConnectionNote } from "@/lib/contracts";
import { Trash2, Plus } from "lucide-react";

interface NotesSectionProps {
  notes: ConnectionNote[];
  onCreate: (body: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}

export function NotesSection({
  notes,
  onCreate,
  onDelete,
}: NotesSectionProps) {
  const [newNote, setNewNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setCreating(true);
    await onCreate(newNote.trim());
    setNewNote("");
    setCreating(false);
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    await onDelete(noteId);
    setDeletingId(null);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Notes</h3>

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a private note..."
          className="flex-1"
        />
        <Button type="submit" isLoading={creating} size="sm">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>

      {notes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface py-8 text-center text-sm text-muted">
          No notes yet. Jot down context about this connection.
        </p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-card"
            >
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {note.body}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(note.id)}
                isLoading={deletingId === note.id}
                className="shrink-0 text-error hover:bg-error-subtle hover:text-error"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete note</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
