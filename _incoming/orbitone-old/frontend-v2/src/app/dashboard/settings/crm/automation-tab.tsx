import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAutomationRules,
  useCreateAutomationRule,
  useUpdateAutomationRule,
  useDeleteAutomationRule,
} from "@/hooks/useCRM";
import type { AutomationRule, AutomationRuleInput, AutomationTrigger } from "@/lib/contracts";
import { Plus, Trash2, Pencil } from "lucide-react";

const triggerLabels: Record<AutomationTrigger, string> = {
  customer_created: "Customer created",
  stage_changed: "Stage changed",
  lifecycle_changed: "Lifecycle changed",
  activity_created: "Activity created",
  follow_up_created: "Follow-up created",
  follow_up_completed: "Follow-up completed",
};

export function AutomationTab() {
  const { data: rules = [], isLoading } = useAutomationRules();
  const create = useCreateAutomationRule();
  const update = useUpdateAutomationRule();
  const remove = useDeleteAutomationRule();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);

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
        <CardTitle>Automation rules</CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add rule
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rules.length === 0 ? (
          <p className="text-sm text-muted">No automation rules yet.</p>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{rule.name}</p>
                  <p className="text-xs text-muted">{triggerLabels[rule.triggerEvent]}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(rule); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(rule.id)} disabled={remove.isPending}>
                    <Trash2 className="h-4 w-4 text-error" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                {rule.isActive ? "Active" : "Paused"} · {rule.actions.length} action{rule.actions.length === 1 ? "" : "s"}
              </p>
            </div>
          ))
        )}
      </CardContent>

      <AutomationDialog
        open={open}
        onOpenChange={setOpen}
        rule={editing}
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

function AutomationDialog({
  open,
  onOpenChange,
  rule,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AutomationRule | null;
  onSave: (input: AutomationRuleInput) => Promise<void>;
}) {
  const [actions, setActions] = useState<AutomationRuleInput["actions"]>(
    rule?.actions ?? [{ type: "create_follow_up", config: { title: "Follow-up", dueDays: 1 } }]
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await onSave({
      name: fd.get("name") as string,
      triggerEvent: fd.get("triggerEvent") as AutomationTrigger,
      conditions: {},
      actions,
      isActive: fd.get("isActive") === "on",
    });
    e.currentTarget.reset();
    setActions([{ type: "create_follow_up", config: { title: "Follow-up", dueDays: 1 } }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit automation rule" : "New automation rule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={rule?.name} required />
          </div>
          <div>
            <Label htmlFor="triggerEvent">Trigger</Label>
            <select
              id="triggerEvent"
              name="triggerEvent"
              defaultValue={rule?.triggerEvent ?? "stage_changed"}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              {Object.entries(triggerLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Actions</Label>
            <div className="mt-2 space-y-2">
              {actions.map((action, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-surface-elevated p-3">
                  <select
                    value={action.type}
                    onChange={(e) => {
                      const next = [...actions];
                      next[idx] = { type: e.target.value as typeof action.type, config: {} };
                      setActions(next);
                    }}
                    className="mb-2 block w-full rounded-md border border-border bg-surface px-2 py-1 text-sm"
                  >
                    <option value="create_follow_up">Create follow-up</option>
                    <option value="create_activity">Create activity</option>
                    <option value="send_webhook">Send webhook</option>
                  </select>
                  {action.type === "create_follow_up" && (
                    <>
                      <Input
                        placeholder="Title"
                        value={(action.config.title as string) ?? ""}
                        onChange={(e) => {
                          const next = [...actions];
                          next[idx].config.title = e.target.value;
                          setActions(next);
                        }}
                        className="mb-2"
                      />
                      <Input
                        type="number"
                        placeholder="Due in days"
                        value={(action.config.dueDays as number) ?? 1}
                        onChange={(e) => {
                          const next = [...actions];
                          next[idx].config.dueDays = Number(e.target.value);
                          setActions(next);
                        }}
                      />
                    </>
                  )}
                  {action.type === "create_activity" && (
                    <>
                      <Input
                        placeholder="Title"
                        value={(action.config.title as string) ?? ""}
                        onChange={(e) => {
                          const next = [...actions];
                          next[idx].config.title = e.target.value;
                          setActions(next);
                        }}
                        className="mb-2"
                      />
                      <Input
                        placeholder="Body"
                        value={(action.config.body as string) ?? ""}
                        onChange={(e) => {
                          const next = [...actions];
                          next[idx].config.body = e.target.value;
                          setActions(next);
                        }}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setActions([...actions, { type: "create_follow_up", config: {} }])}
            >
              Add action
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <input id="isActive" name="isActive" type="checkbox" defaultChecked={rule?.isActive ?? true} />
            <Label htmlFor="isActive" className="mb-0">Active</Label>
          </div>
          <Button type="submit" className="w-full">{rule ? "Save changes" : "Create rule"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
