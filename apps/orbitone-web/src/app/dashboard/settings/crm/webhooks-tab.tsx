"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useWebhookSubscriptions,
  useCreateWebhookSubscription,
  useUpdateWebhookSubscription,
  useDeleteWebhookSubscription,
} from "@/hooks/useCRM";
import type { WebhookSubscription, WebhookSubscriptionInput } from "@/lib/contracts";
import { Plus, Trash2, Pencil } from "lucide-react";

export function WebhooksTab() {
  const { data: subscriptions = [], isLoading } = useWebhookSubscriptions();
  const create = useCreateWebhookSubscription();
  const update = useUpdateWebhookSubscription();
  const remove = useDeleteWebhookSubscription();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WebhookSubscription | null>(null);

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
        <CardTitle>Webhooks</CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add webhook
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {subscriptions.length === 0 ? (
          <p className="text-sm text-muted">No webhook subscriptions yet.</p>
        ) : (
          subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{sub.url}</p>
                  <p className="text-xs text-muted">{sub.events.join(", ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(sub); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(sub.id)} disabled={remove.isPending}>
                    <Trash2 className="h-4 w-4 text-error" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">{sub.isActive ? "Active" : "Paused"}</p>
            </div>
          ))
        )}
      </CardContent>

      <WebhookDialog
        open={open}
        onOpenChange={setOpen}
        subscription={editing}
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

function WebhookDialog({
  open,
  onOpenChange,
  subscription,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: WebhookSubscription | null;
  onSave: (input: WebhookSubscriptionInput) => Promise<void>;
}) {
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const events = (fd.get("events") as string).split(",").map((s) => s.trim()).filter(Boolean);
    await onSave({
      url: fd.get("url") as string,
      events,
      secret: (fd.get("secret") as string) || null,
    });
    e.currentTarget.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{subscription ? "Edit webhook" : "New webhook"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="url">URL</Label>
            <Input id="url" name="url" type="url" defaultValue={subscription?.url} required />
          </div>
          <div>
            <Label htmlFor="events">Events (comma-separated)</Label>
            <Input
              id="events"
              name="events"
              defaultValue={subscription?.events.join(", ") ?? "customer_created, stage_changed"}
              required
            />
          </div>
          <div>
            <Label htmlFor="secret">Secret (optional)</Label>
            <Input id="secret" name="secret" defaultValue={subscription?.secret ?? ""} />
          </div>
          <Button type="submit" className="w-full">{subscription ? "Save changes" : "Create webhook"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
