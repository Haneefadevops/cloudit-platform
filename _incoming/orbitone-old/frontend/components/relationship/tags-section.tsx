"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tag } from "@/lib/contracts";
import { X, Plus, TagIcon } from "lucide-react";

interface TagsSectionProps {
  availableTags: Tag[];
  assignedTags: Tag[];
  onCreate: (name: string, color: string) => Promise<void>;
  onAssign: (tagIds: string[]) => Promise<void>;
  onDeleteTag: (tagId: string) => Promise<void>;
}

const tagColors = [
  { name: "slate", value: "#64748B", className: "bg-slate-100 text-slate-700 border-slate-200" },
  { name: "red", value: "#DC2626", className: "bg-red-100 text-red-700 border-red-200" },
  { name: "orange", value: "#EA580C", className: "bg-orange-100 text-orange-700 border-orange-200" },
  { name: "amber", value: "#D97706", className: "bg-amber-100 text-amber-700 border-amber-200" },
  { name: "green", value: "#16A34A", className: "bg-green-100 text-green-700 border-green-200" },
  { name: "emerald", value: "#059669", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { name: "teal", value: "#0D9488", className: "bg-teal-100 text-teal-700 border-teal-200" },
  { name: "cyan", value: "#06B6D4", className: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { name: "blue", value: "#2563EB", className: "bg-blue-100 text-blue-700 border-blue-200" },
  { name: "indigo", value: "#4F46E5", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { name: "purple", value: "#9333EA", className: "bg-purple-100 text-purple-700 border-purple-200" },
  { name: "pink", value: "#DB2777", className: "bg-pink-100 text-pink-700 border-pink-200" },
];

export function TagsSection({
  availableTags,
  assignedTags,
  onCreate,
  onAssign,
  onDeleteTag,
}: TagsSectionProps) {
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(tagColors[0].value);
  const [creating, setCreating] = useState(false);
  const [isManaging, setIsManaging] = useState(false);

  const assignedIds = new Set(assignedTags.map((t) => t.id));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTagName.trim()) return;
    setCreating(true);
    await onCreate(newTagName.trim(), selectedColor);
    setNewTagName("");
    setCreating(false);
  }

  function toggleAssignment(tagId: string) {
    const nextIds = new Set(assignedIds);
    if (nextIds.has(tagId)) {
      nextIds.delete(tagId);
    } else {
      nextIds.add(tagId);
    }
    onAssign(Array.from(nextIds));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Tags</h3>
        {availableTags.length > 0 && (
          <button
            type="button"
            onClick={() => setIsManaging(!isManaging)}
            className="text-sm font-medium text-secondary hover:underline"
          >
            {isManaging ? "Done" : "Manage tags"}
          </button>
        )}
      </div>

      <form onSubmit={handleCreate} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex gap-2">
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="New tag name..."
            className="flex-1"
          />
          <Button type="submit" isLoading={creating} size="sm">
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tagColors.map((color) => (
            <button
              key={color.name}
              type="button"
              onClick={() => setSelectedColor(color.value)}
              className={[
                "h-6 w-6 rounded-full border-2 transition-colors",
                color.className.split(" ")[0],
                selectedColor === color.value
                  ? "border-primary"
                  : "border-transparent hover:border-muted",
              ].join(" ")}
              aria-label={`Select ${color.name} color`}
            />
          ))}
        </div>
      </form>

      {availableTags.length === 0 ? (
        <p className="text-sm text-muted">
          Create your first tag above to organize connections.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => {
            const isAssigned = assignedIds.has(tag.id);
            const colorClass =
              tagColors.find((c) => c.value.toLowerCase() === tag.color.toLowerCase())?.className ||
              tagColors[0].className;

            return (
              <div
                key={tag.id}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                  colorClass,
                  isAssigned ? "ring-2 ring-offset-1 ring-secondary shadow-sm" : "opacity-70 hover:opacity-100",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => toggleAssignment(tag.id)}
                  className="inline-flex items-center gap-1.5"
                >
                  <TagIcon className="h-3.5 w-3.5" />
                  {tag.name}
                </button>
                {isManaging && (
                  <button
                    type="button"
                    onClick={() => onDeleteTag(tag.id)}
                    className="ml-1 rounded-full p-0.5 hover:bg-black/10"
                    aria-label={`Delete ${tag.name} tag`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
