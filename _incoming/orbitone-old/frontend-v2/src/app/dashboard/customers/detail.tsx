import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useCustomerActivities,
  useCreateCustomerActivity,
  useCustomerFollowUps,
  useCreateCustomerFollowUp,
  useCompleteCustomerFollowUp,
  useDeleteCustomerFollowUp,
  useCustomerStageHistory,
  useUpdateCustomerLifecycle,
  useAssignCustomer,
  useCloseCustomer,
  useCustomFields,
  useDefaultPipeline,
  useMoveCustomerStage,
  useActivityTypes,
  useTemplates,
} from "@/hooks/useCRM";
import { useOrganizationMembers } from "@/hooks/useOrganizations";
import { DocumentsTab } from "./documents-tab";
import { FeedbackTab } from "./feedback-tab";
import type {
  Customer,
  LifecycleStage,
  Priority,
  CustomerActivityType,
  CustomerFollowUp,
  CustomerOutcome,
  CustomFieldDefinition,
} from "@/lib/contracts";
import {
  ArrowLeft,
  Plus,
  Check,
  Trash2,
  Phone,
  Mail,
  Building2,
  Calendar,
  History,
  RotateCcw,
  Trophy,
  XCircle,
  UserCircle,
  FileText,
  MessageSquare,
} from "lucide-react";

const lifecycleVariant: Record<LifecycleStage, BadgeProps["variant"]> = {
  new: "default",
  contacted: "secondary",
  qualified: "accent",
  meeting: "secondary",
  proposal: "warning",
  customer: "success",
  lost: "outline",
  archived: "outline",
};

const priorityVariant: Record<Priority, BadgeProps["variant"]> = {
  low: "outline",
  medium: "accent",
  high: "error",
};

const outcomeVariant: Record<Customer["outcome"], BadgeProps["variant"]> = {
  in_progress: "secondary",
  won: "success",
  lost: "error",
  nurture: "accent",
};

const activityTypeLabels: Record<CustomerActivityType, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  sms: "SMS",
  whatsapp: "WhatsApp",
  other: "Other",
};

const lifecycleOrder: LifecycleStage[] = [
  "new",
  "contacted",
  "qualified",
  "meeting",
  "proposal",
  "customer",
];

function lifecycleLabel(stage: LifecycleStage) {
  return stage.replace(/_/g, " ");
}

function outcomeLabel(outcome: CustomerOutcome) {
  return outcome.replace(/_/g, " ");
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id);
  const { data: activities = [], isLoading: activitiesLoading } = useCustomerActivities(id);
  const { data: followUps = [], isLoading: followUpsLoading } = useCustomerFollowUps(id);
  const { data: history = [], isLoading: historyLoading } = useCustomerStageHistory(id);
  const update = useUpdateCustomer(id);
  const deleteCustomer = useDeleteCustomer();
  const [activeTab, setActiveTab] = useState<"cycle" | "details" | "timeline" | "documents" | "feedback">("cycle");

  const onUpdate = async (patch: Partial<Customer>) => {
    await update.mutateAsync(patch);
  };

  const onDelete = async () => {
    if (!id) return;
    if (confirm("Delete this customer? This cannot be undone.")) {
      await deleteCustomer.mutateAsync(id);
      navigate("/dashboard/customers");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <p className="text-muted">Customer not found.</p>
        <Button className="mt-4" asChild>
          <Link to="/dashboard/customers">Back to customers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/dashboard/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-primary">{customer.fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={lifecycleVariant[customer.lifecycleStage]}>
              {lifecycleLabel(customer.lifecycleStage)}
            </Badge>
            <PipelineStageSelector customer={customer} />
            <Badge variant={priorityVariant[customer.priority]}>{customer.priority}</Badge>
            {customer.outcome !== "in_progress" && (
              <Badge variant={outcomeVariant[customer.outcome]}>{outcomeLabel(customer.outcome)}</Badge>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={onDelete} disabled={deleteCustomer.isPending}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      <div className="mt-6 flex gap-2 border-b border-border pb-2">
        {[
          { key: "cycle", label: "Cycle", icon: RotateCcw },
          { key: "details", label: "Details", icon: UserCircle },
          { key: "timeline", label: "Timeline", icon: History },
          { key: "documents", label: "Documents", icon: FileText },
          { key: "feedback", label: "Feedback", icon: MessageSquare },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
          >
            <tab.icon className="mr-2 h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "cycle" && (
        <CycleTab
          customer={customer}
          history={history}
          historyLoading={historyLoading}
          onUpdate={onUpdate}
        />
      )}
      {activeTab === "details" && <DetailsTab customer={customer} onUpdate={onUpdate} />}
      {activeTab === "timeline" && (
        <TimelineTab
          customerId={id}
          activities={activities}
          followUps={followUps}
          activitiesLoading={activitiesLoading}
          followUpsLoading={followUpsLoading}
        />
      )}
      {activeTab === "documents" && id && <DocumentsTab customerId={id} />}
      {activeTab === "feedback" && id && <FeedbackTab customerId={id} />}
    </div>
  );
}

function CycleTab({
  customer,
  history,
  historyLoading,
  onUpdate,
}: {
  customer: Customer;
  history: import("@/lib/contracts").CustomerStageHistory[];
  historyLoading: boolean;
  onUpdate: (patch: Partial<Customer>) => void;
}) {
  const lifecycle = useUpdateCustomerLifecycle(customer.id);
  const assign = useAssignCustomer(customer.id);
  const close = useCloseCustomer(customer.id);
  const [stageNote, setStageNote] = useState("");
  const [selectedStage, setSelectedStage] = useState<LifecycleStage>(customer.lifecycleStage);
  const { data: members = [] } = useOrganizationMembers();

  const currentIndex = lifecycleOrder.indexOf(customer.lifecycleStage);
  const nextStage = lifecycleOrder[currentIndex + 1];

  const handleStageChange = async (stage: LifecycleStage) => {
    await lifecycle.mutateAsync({ lifecycleStage: stage, note: stageNote || null });
    setStageNote("");
  };

  const handleClose = async (outcome: CustomerOutcome) => {
    const reason = outcome === "in_progress" ? null : window.prompt("Reason (optional):") || null;
    await close.mutateAsync({ outcome, closedReason: reason });
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Deal cycle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted">Current stage:</span>
              <Badge variant={lifecycleVariant[customer.lifecycleStage]}>
                {lifecycleLabel(customer.lifecycleStage)}
              </Badge>
              {customer.outcome !== "in_progress" && (
                <Badge variant={outcomeVariant[customer.outcome]}>{outcomeLabel(customer.outcome)}</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {nextStage && customer.outcome === "in_progress" && (
                <Button size="sm" onClick={() => handleStageChange(nextStage)} isLoading={lifecycle.isPending}>
                  Move to {lifecycleLabel(nextStage)}
                </Button>
              )}
              {customer.outcome === "in_progress" && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => handleClose("won")} isLoading={close.isPending}>
                    <Trophy className="mr-1 h-4 w-4" />
                    Close won
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleClose("lost")} isLoading={close.isPending}>
                    <XCircle className="mr-1 h-4 w-4" />
                    Close lost
                  </Button>
                </>
              )}
              {customer.outcome !== "in_progress" && (
                <Button size="sm" variant="outline" onClick={() => handleClose("in_progress")} isLoading={close.isPending}>
                  <RotateCcw className="mr-1 h-4 w-4" />
                  Reopen
                </Button>
              )}
            </div>

            <div className="rounded-md border border-border bg-surface p-4">
              <p className="text-sm font-medium text-foreground">Change stage with note</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value as LifecycleStage)}
                >
                  {lifecycleOrder.map((s) => (
                    <option key={s} value={s}>
                      {lifecycleLabel(s)}
                    </option>
                  ))}
                </Select>
                <Textarea
                  placeholder="Why is the stage changing?"
                  value={stageNote}
                  onChange={(e) => setStageNote(e.target.value)}
                  rows={2}
                />
              </div>
              <Button
                className="mt-3"
                size="sm"
                onClick={() => handleStageChange(selectedStage)}
                isLoading={lifecycle.isPending}
              >
                Update stage
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Stage history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : history.length === 0 ? (
              <p className="text-sm text-muted">No stage changes yet.</p>
            ) : (
              <ul className="space-y-4">
                {history.map((h) => (
                  <li key={h.id} className="border-l-2 border-border pl-4">
                    <p className="text-sm font-medium text-foreground">
                      {h.fromStage ? lifecycleLabel(h.fromStage) : "Created"} → {lifecycleLabel(h.toStage)}
                    </p>
                    {h.note && <p className="mt-1 text-sm text-muted">{h.note}</p>}
                    <p className="mt-1 text-xs text-muted">{new Date(h.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              Ownership
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assigned to</Label>
              {members.length > 0 ? (
                <Select
                  id="assignedTo"
                  value={customer.assignedToUserId ?? ""}
                  onChange={(e) => assign.mutateAsync({ assignedToUserId: e.target.value })}
                >
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.fullName}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input value="Me" disabled />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valueAmount">Deal value</Label>
              <div className="flex gap-2">
                <Input
                  id="valueCurrency"
                  className="w-20"
                  defaultValue={customer.valueCurrency}
                  onBlur={(e) => onUpdate({ valueCurrency: e.target.value })}
                />
                <Input
                  id="valueAmount"
                  type="number"
                  defaultValue={customer.valueAmount ?? ""}
                  onBlur={(e) => onUpdate({ valueAmount: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedCloseDate">Expected close date</Label>
              <Input
                id="expectedCloseDate"
                type="date"
                defaultValue={customer.expectedCloseDate ?? ""}
                onBlur={(e) => onUpdate({ expectedCloseDate: e.target.value || null })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted">
              Source: <span className="capitalize">{customer.source}</span>
            </p>
            <p className="text-sm text-muted">
              Added {new Date(customer.createdAt).toLocaleDateString()}
            </p>
            {customer.lastContactedAt && (
              <p className="text-sm text-muted">
                Last contacted {new Date(customer.lastContactedAt).toLocaleDateString()}
              </p>
            )}
            {customer.closedAt && (
              <p className="text-sm text-muted">
                Closed {new Date(customer.closedAt).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailsTab({ customer, onUpdate }: { customer: Customer; onUpdate: (patch: Partial<Customer>) => void }) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Name</Label>
              <Input
                id="fullName"
                defaultValue={customer.fullName}
                onBlur={(e) => onUpdate({ fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                defaultValue={customer.company ?? ""}
                onBlur={(e) => onUpdate({ company: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  id="email"
                  className="pl-9"
                  type="email"
                  defaultValue={customer.email ?? ""}
                  onBlur={(e) => onUpdate({ email: e.target.value || null })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  id="phone"
                  className="pl-9"
                  type="tel"
                  defaultValue={customer.phone ?? ""}
                  onBlur={(e) => onUpdate({ phone: e.target.value || null })}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lifecycleStage">Lifecycle</Label>
              <Select
                id="lifecycleStage"
                defaultValue={customer.lifecycleStage}
                onChange={(e) => onUpdate({ lifecycleStage: e.target.value as LifecycleStage })}
              >
                {["new", "contacted", "qualified", "meeting", "proposal", "customer", "lost", "archived"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {lifecycleLabel(s as LifecycleStage)}
                    </option>
                  )
                )}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                id="priority"
                defaultValue={customer.priority}
                onChange={(e) => onUpdate({ priority: e.target.value as Priority })}
              >
                {["low", "medium", "high"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nextStep">Next step</Label>
            <Input
              id="nextStep"
              placeholder="e.g., Send proposal by Friday"
              defaultValue={customer.nextStep ?? ""}
              onBlur={(e) => onUpdate({ nextStep: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={4}
              defaultValue={customer.notes ?? ""}
              onBlur={(e) => onUpdate({ notes: e.target.value || null })}
            />
          </div>
          <CustomFieldsSection customer={customer} onUpdate={onUpdate} />
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NewFollowUpDialog customerId={customer.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TimelineTab({
  customerId,
  activities,
  followUps,
  activitiesLoading,
  followUpsLoading,
}: {
  customerId: string | undefined;
  activities: import("@/lib/contracts").CustomerActivity[];
  followUps: CustomerFollowUp[];
  activitiesLoading: boolean;
  followUpsLoading: boolean;
}) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Activity timeline</CardTitle>
          <NewActivityDialog customerId={customerId} />
        </CardHeader>
        <CardContent>
          {activitiesLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : activities.length === 0 ? (
            <p className="text-muted">No activities yet.</p>
          ) : (
            <ul className="space-y-4">
              {activities.map((activity) => (
                <li key={activity.id} className="border-l-2 border-border pl-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{activity.title}</p>
                    <Badge variant="outline">{activityTypeLabels[activity.type]}</Badge>
                  </div>
                  {activity.body && <p className="mt-1 text-sm text-muted">{activity.body}</p>}
                  <p className="mt-1 text-xs text-muted">
                    {new Date(activity.occurredAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Follow-ups
          </CardTitle>
          <NewFollowUpDialog customerId={customerId} />
        </CardHeader>
        <CardContent>
          {followUpsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : followUps.length === 0 ? (
            <p className="text-sm text-muted">No follow-ups yet.</p>
          ) : (
            <ul className="space-y-3">
              {followUps.map((followUp) => (
                <FollowUpItem key={followUp.id} customerId={customerId} followUp={followUp} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewActivityDialog({ customerId }: { customerId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const create = useCreateCustomerActivity(customerId);
  const { data: activityTypes = [] } = useActivityTypes();
  const { data: templates = [] } = useTemplates();
  const [selectedType, setSelectedType] = useState<CustomerActivityType | string>("note");
  const [selectedTypeDefinitionId, setSelectedTypeDefinitionId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const builtInOptions: { value: string; label: string; id?: string; isCustom: boolean }[] =
    Object.entries(activityTypeLabels).map(([value, label]) => ({ value, label, isCustom: false }));
  const customOptions: { value: string; label: string; id: string; isCustom: boolean }[] =
    activityTypes.map((t) => ({ value: t.key, label: t.name, id: t.id, isCustom: true }));
  const typeOptions = [...builtInOptions, ...customOptions];

  const activityTemplates = templates.filter((t) => t.type === "activity");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const custom = customOptions.find((o) => o.value === selectedType);
    await create.mutateAsync({
      type: (custom ? "other" : selectedType) as CustomerActivityType,
      activityTypeDefinitionId: custom?.id,
      title,
      body: body || null,
      occurredAt: new Date().toISOString(),
    });
    setOpen(false);
    setSelectedType("note");
    setSelectedTypeDefinitionId("");
    setTitle("");
    setBody("");
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        Add activity
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add activity</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="template">Template (optional)</Label>
              <select
                id="template"
                className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                onChange={(e) => {
                  const template = activityTemplates.find((t) => t.id === e.target.value);
                  if (template) {
                    setTitle(template.subject ?? template.name);
                    setBody(template.body);
                  }
                }}
              >
                <option value="">—</option>
                {activityTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                value={selectedTypeDefinitionId || selectedType}
                onChange={(e) => {
                  const value = e.target.value;
                  const custom = customOptions.find((o) => o.id === value);
                  if (custom) {
                    setSelectedType(custom.value);
                    setSelectedTypeDefinitionId(custom.id);
                  } else {
                    setSelectedType(value as CustomerActivityType);
                    setSelectedTypeDefinitionId("");
                  }
                }}
                className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                {typeOptions.map((opt) => (
                  <option key={opt.value + (opt.isCustom ? opt.id : "")} value={opt.isCustom ? opt.id : opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="body">Details</Label>
              <Textarea id="body" name="body" value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? "Saving..." : "Save activity"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewFollowUpDialog({ customerId }: { customerId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const create = useCreateCustomerFollowUp(customerId);
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const date = fd.get("dueDate") as string;
    const time = (fd.get("dueTime") as string) || "09:00";
    await create.mutateAsync({
      title: fd.get("title") as string,
      dueAt: new Date(`${date}T${time}`).toISOString(),
    });
    setOpen(false);
    form.reset();
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        Add
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New follow-up</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dueDate">Date</Label>
                <Input id="dueDate" name="dueDate" type="date" required />
              </div>
              <div>
                <Label htmlFor="dueTime">Time</Label>
                <Input id="dueTime" name="dueTime" type="time" defaultValue="09:00" required />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? "Saving..." : "Save follow-up"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FollowUpItem({ customerId, followUp }: { customerId: string | undefined; followUp: CustomerFollowUp }) {
  const complete = useCompleteCustomerFollowUp(customerId);
  const remove = useDeleteCustomerFollowUp(customerId);
  const isDone = !!followUp.completedAt;
  const isOverdue = !isDone && new Date(followUp.dueAt) < new Date();

  return (
    <li className="flex items-start justify-between gap-3">
      <div className={isDone ? "opacity-60" : ""}>
        <p className="text-sm font-medium text-foreground">{followUp.title}</p>
        <p className="text-xs text-muted">
          Due {new Date(followUp.dueAt).toLocaleString()}
          {isOverdue && <span className="ml-2 text-error">Overdue</span>}
        </p>
      </div>
      <div className="flex gap-1">
        {!isDone && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => complete.mutate({ followUpId: followUp.id, completed: true })}
            disabled={complete.isPending}
          >
            <Check className="h-4 w-4 text-success" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => remove.mutate(followUp.id)} disabled={remove.isPending}>
          <Trash2 className="h-4 w-4 text-error" />
        </Button>
      </div>
    </li>
  );
}

function PipelineStageSelector({ customer }: { customer: Customer }) {
  const { data: pipeline } = useDefaultPipeline();
  const move = useMoveCustomerStage(customer.id);

  if (!pipeline || !customer.pipelineId) return null;

  return (
    <select
      value={customer.pipelineStageId ?? ""}
      onChange={(e) => move.mutate({ pipelineStageId: e.target.value })}
      disabled={move.isPending}
      className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground outline-none focus:border-primary"
    >
      {pipeline.stages.map((stage) => (
        <option key={stage.id} value={stage.id}>
          {stage.name}
        </option>
      ))}
    </select>
  );
}

function CustomFieldsSection({ customer, onUpdate }: { customer: Customer; onUpdate: (patch: Partial<Customer>) => void }) {
  const { data: definitions = [], isLoading } = useCustomFields();
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(customer.customFieldValues.map((v) => [v.definitionId, v.value]))
  );

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (definitions.length === 0) return null;

  const save = () => {
    onUpdate({
      customFieldValues: definitions.map((d) => ({
        definitionId: d.id,
        value: values[d.id] ?? null,
      })),
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-foreground">Custom fields</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {definitions.map((def) => (
          <CustomFieldInput
            key={def.id}
            definition={def}
            value={values[def.id]}
            onChange={(value) => setValues((prev) => ({ ...prev, [def.id]: value }))}
            onBlur={save}
          />
        ))}
      </div>
    </div>
  );
}

function CustomFieldInput({
  definition,
  value,
  onChange,
  onBlur,
}: {
  definition: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
}) {
  const inputClass = "mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";

  if (definition.type === "single_select") {
    return (
      <div>
        <Label>{definition.name}</Label>
        <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)} onBlur={onBlur} className={inputClass}>
          <option value="">—</option>
          {definition.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (definition.type === "multi_select") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div>
        <Label>{definition.name}</Label>
        <div className="mt-1 space-y-1">
          {definition.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={(e) => {
                  const next = e.target.checked ? [...selected, opt] : selected.filter((s) => s !== opt);
                  onChange(next);
                }}
                onBlur={onBlur}
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
    );
  }

  const commonProps = {
    value: value === null || value === undefined ? "" : String(value),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value || null),
    onBlur,
    className: inputClass,
  };

  return (
    <div>
      <Label>{definition.name}</Label>
      <Input
        type={definition.type === "number" ? "number" : definition.type === "date" ? "date" : definition.type === "email" ? "email" : definition.type === "url" ? "url" : "text"}
        {...commonProps}
      />
    </div>
  );
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      {...props}
    >
      {children}
    </select>
  );
}
