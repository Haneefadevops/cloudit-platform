import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActivityTypes,
  useCreateActivityType,
  useUpdateActivityType,
  useDeleteActivityType,
} from "@/hooks/useCRM";
import type { ActivityTypeDefinition, ActivityTypeDefinitionInput } from "@/lib/contracts";
import { Plus, Trash2, Pencil } from "lucide-react";

export function ActivityTypesTab() {
  const { data: types = [], isLoading } = useActivityTypes();
  const create = useCreateActivityType();
  const update = useUpdateActivityType();
  const remove = useDeleteActivityType();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityTypeDefinition | null>(null);

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
        <CardTitle>Activity types</CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add type
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {types.length === 0 ? (
          <p className="text-sm text-muted">No custom activity types yet.</p>
        ) : (
          types.map((type) => (
            <div
              key={type.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
            >
              <div>
                <p className="font-medium text-foreground">{type.name}</p>
                <p className="text-xs text-muted">{type.key} {type.icon && `· ${type.icon}`}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(type); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(type.id)} disabled={remove.isPending}>
                  <Trash2 className="h-4 w-4 text-error" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <ActivityTypeDialog
        open={open}
        onOpenChange={setOpen}
        field={editing}
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

function ActivityTypeDialog({
  open,
  onOpenChange,
  field,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: ActivityTypeDefinition | null;
  onSave: (input: ActivityTypeDefinitionInput) => Promise<void>;
}) {
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await onSave({
      name: fd.get("name") as string,
      key: fd.get("key") as string,
      icon: (fd.get("icon") as string) || null,
      order: Number(fd.get("order") || 0),
    });
    e.currentTarget.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{field ? "Edit activity type" : "New activity type"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={field?.name} required />
          </div>
          <div>
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              name="key"
              defaultValue={field?.key}
              required
              pattern="^[a-z0-9_]+$"
              title="Lowercase letters, numbers, underscores"
            />
          </div>
          <div>
            <Label htmlFor="icon">Icon (optional)</Label>
            <Input id="icon" name="icon" defaultValue={field?.icon ?? ""} />
          </div>
          <div>
            <Label htmlFor="order">Order</Label>
            <Input id="order" name="order" type="number" defaultValue={field?.order ?? 0} />
          </div>
          <Button type="submit" className="w-full">{field ? "Save changes" : "Create type"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
