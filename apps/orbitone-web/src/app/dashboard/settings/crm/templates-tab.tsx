"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from "@/hooks/useCRM";
import type { CRMTemplate, CRMTemplateInput } from "@/lib/contracts";
import { Plus, Trash2, Pencil } from "lucide-react";

const typeLabels: Record<CRMTemplate["type"], string> = {
  activity: "Activity",
  follow_up: "Follow-up",
  email: "Email",
  note: "Note",
};

export function TemplatesTab() {
  const { data: templates = [], isLoading } = useTemplates();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const remove = useDeleteTemplate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CRMTemplate | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Templates</CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add template
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {templates.length === 0 ? (
          <p className="text-sm text-muted">No templates yet.</p>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{template.name}</p>
                  <p className="text-xs text-muted">{typeLabels[template.type]}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(template); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(template.id)} disabled={remove.isPending}>
                    <Trash2 className="h-4 w-4 text-error" />
                  </Button>
                </div>
              </div>
              {template.subject && <p className="mt-2 text-sm text-muted">{template.subject}</p>}
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{template.body}</p>
            </div>
          ))
        )}
      </CardContent>

      <TemplateDialog
        open={open}
        onOpenChange={setOpen}
        template={editing}
        onSave={async (input) => {
          if (editing) {
            await update.mutateAsync({ id: editing.id, ...input });
          } else {
            await create.mutateAsync(input);
          }
          setOpen(false);
        }}
      />
    </Card>
  );
}

function TemplateDialog({
  open,
  onOpenChange,
  template,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: CRMTemplate | null;
  onSave: (input: CRMTemplateInput) => Promise<void>;
}) {
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await onSave({
      name: fd.get("name") as string,
      type: fd.get("type") as CRMTemplate["type"],
      subject: (fd.get("subject") as string) || null,
      body: fd.get("body") as string,
    });
    e.currentTarget.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={template?.name} required />
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              name="type"
              defaultValue={template?.type ?? "activity"}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="activity">Activity</option>
              <option value="follow_up">Follow-up</option>
              <option value="email">Email</option>
              <option value="note">Note</option>
            </select>
          </div>
          <div>
            <Label htmlFor="subject">Subject (optional)</Label>
            <Input id="subject" name="subject" defaultValue={template?.subject ?? ""} />
          </div>
          <div>
            <Label htmlFor="body">Body</Label>
            <Textarea id="body" name="body" defaultValue={template?.body} rows={6} required />
          </div>
          <Button type="submit" className="w-full">{template ? "Save changes" : "Create template"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
