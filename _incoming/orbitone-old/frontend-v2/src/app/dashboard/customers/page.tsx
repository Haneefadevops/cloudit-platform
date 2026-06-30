import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useCustomers,
  useCreateCustomer,
  useDefaultPipeline,
  useBulkAction,
  useImportCustomers,
  type CustomerFilters,
} from "@/hooks/useCRM";
import type { Customer, LifecycleStage, Priority, CustomerImportRow } from "@/lib/contracts";
import { Search, Plus, Zap, SlidersHorizontal, Kanban, Trash2, Download, Upload, Copy, Users } from "lucide-react";

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

function lifecycleLabel(stage: LifecycleStage) {
  return stage.replace(/_/g, " ");
}

export function CustomersPage() {
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filters, setFilters] = useState<CustomerFilters>({});
  const { data = [], isLoading, error } = useCustomers(filters);
  const { data: pipeline } = useDefaultPipeline();
  const create = useCreateCustomer();
  const bulkAction = useBulkAction();
  const importCustomers = useImportCustomers();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    await create.mutateAsync({
      fullName: fd.get("fullName") as string,
      email: (fd.get("email") as string) || null,
      phone: (fd.get("phone") as string) || null,
      company: (fd.get("company") as string) || null,
      notes: (fd.get("notes") as string) || null,
      lifecycleStage: (fd.get("lifecycleStage") as LifecycleStage) || "new",
      priority: (fd.get("priority") as Priority) || "medium",
      source: "manual",
    });
    setOpen(false);
    form.reset();
  };

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Customers</h1>
          <p className="text-muted">Manage contacts and relationships.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/customers/duplicates">
              <Copy className="mr-2 h-4 w-4" />
              Duplicates
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/customers/pipeline">
              <Kanban className="mr-2 h-4 w-4" />
              Pipeline
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add customer
          </Button>
        </div>
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImport={(rows) => importCustomers.mutate(rows as CustomerImportRow[], { onSuccess: () => setImportOpen(false) })}
        />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New customer</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 pt-2">
              <div>
                <Label htmlFor="fullName">Name</Label>
                <Input id="fullName" name="fullName" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" type="tel" />
                </div>
              </div>
              <div>
                <Label htmlFor="company">Company</Label>
                <Input id="company" name="company" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lifecycleStage">Lifecycle</Label>
                  <Select name="lifecycleStage" id="lifecycleStage">
                    {["new", "contacted", "qualified", "meeting", "proposal", "customer", "lost", "archived"].map(
                      (s) => (
                        <option key={s} value={s}>
                          {lifecycleLabel(s as LifecycleStage)}
                        </option>
                      )
                    )}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select name="priority" id="priority">
                    {["low", "medium", "high"].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending ? "Saving..." : "Save customer"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search customers..."
            className="pl-9"
            value={filters.search ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={filters.lifecycleStage ?? ""}
            onChange={(v) => setFilters((f) => ({ ...f, lifecycleStage: (v as LifecycleStage) || undefined }))}
            options={[
              { label: "All stages", value: "" },
              ...(["new", "contacted", "qualified", "meeting", "proposal", "customer", "lost", "archived"] as LifecycleStage[]).map(
                (s) => ({ label: lifecycleLabel(s), value: s })
              ),
            ]}
          />
          <FilterSelect
            value={filters.priority ?? ""}
            onChange={(v) => setFilters((f) => ({ ...f, priority: (v as Priority) || undefined }))}
            options={[
              { label: "All priorities", value: "" },
              { label: "High", value: "high" },
              { label: "Medium", value: "medium" },
              { label: "Low", value: "low" },
            ]}
          />
          <FilterSelect
            value={filters.outcome ?? ""}
            onChange={(v) => setFilters((f) => ({ ...f, outcome: (v as Customer["outcome"]) || undefined }))}
            options={[
              { label: "All outcomes", value: "" },
              { label: "In progress", value: "in_progress" },
              { label: "Won", value: "won" },
              { label: "Lost", value: "lost" },
              { label: "Nurture", value: "nurture" },
            ]}
          />
          <FilterSelect
            value={`${filters.sortBy ?? "createdAt"}-${filters.sortOrder ?? "desc"}`}
            onChange={(v) => {
              const [sortBy, sortOrder] = v.split("-") as [CustomerFilters["sortBy"], "asc" | "desc"];
              setFilters((f) => ({ ...f, sortBy, sortOrder }));
            }}
            options={[
              { label: "Newest first", value: "createdAt-desc" },
              { label: "Oldest first", value: "createdAt-asc" },
              { label: "Last contacted", value: "lastContactedAt-desc" },
              { label: "Expected close", value: "expectedCloseDate-asc" },
              { label: "Value high-low", value: "valueAmount-desc" },
            ]}
          />
        </div>
      </div>

      {error ? (
        <Card className="mt-6">
          <CardContent className="p-6 text-center">
            <p className="font-medium text-primary">CRM is a Pro Business feature</p>
            <p className="mt-1 text-sm text-muted">Upgrade to unlock customer management.</p>
            <Button className="mt-4" asChild>
              <Link to="/dashboard/upgrade">
                <Zap className="mr-2 h-4 w-4" />
                Upgrade
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Skeleton className="mt-6 h-48 w-full" />
      ) : data.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-muted" />
            <p className="mt-3 text-muted">No customers yet.</p>
            <p className="text-xs text-muted">Add your first contact to start tracking deals.</p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first customer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <BulkToolbar
            selectedIds={selectedIds}
            onClear={() => setSelectedIds(new Set())}
            onToggleAll={() => {
              if (selectedIds.size === data.length) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(data.map((c) => c.id)));
              }
            }}
            allSelected={selectedIds.size === data.length && data.length > 0}
            pipelineStages={pipeline?.stages ?? []}
            onBulkAction={(action, payload) => {
              bulkAction.mutate({ ids: Array.from(selectedIds), action, payload }, {
                onSuccess: () => setSelectedIds(new Set()),
              });
            }}
            onExport={() => {
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "customers.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {data.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                stageName={pipeline?.stages.find((s) => s.id === customer.pipelineStageId)?.name}
                selected={selectedIds.has(customer.id)}
                onSelect={(selected) => {
                  const next = new Set(selectedIds);
                  if (selected) next.add(customer.id);
                  else next.delete(customer.id);
                  setSelectedIds(next);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CustomerCard({
  customer,
  stageName,
  selected,
  onSelect,
}: {
  customer: Customer;
  stageName?: string;
  selected: boolean;
  onSelect: (selected: boolean) => void;
}) {
  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between">
        <Link to={`/dashboard/customers/${customer.id}`} className="flex-1">
          <CardTitle>
            <span className="text-lg font-semibold text-primary">{customer.fullName}</span>
          </CardTitle>
        </Link>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="ml-3 h-4 w-4 accent-secondary"
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant={lifecycleVariant[customer.lifecycleStage]}>
            {lifecycleLabel(customer.lifecycleStage)}
          </Badge>
          {stageName && <Badge variant="outline">{stageName}</Badge>}
          <Badge variant={priorityVariant[customer.priority]}>{customer.priority}</Badge>
          {customer.outcome !== "in_progress" && (
            <Badge variant={outcomeVariant[customer.outcome]}>{customer.outcome}</Badge>
          )}
        </div>
        <div className="text-sm text-muted">
          {customer.email && <p>{customer.email}</p>}
          {customer.phone && <p>{customer.phone}</p>}
          {customer.company && <p>{customer.company}</p>}
        </div>
        {customer.valueAmount ? (
          <p className="text-sm text-foreground">
            <span className="font-medium">Value:</span> {customer.valueCurrency} {customer.valueAmount.toLocaleString()}
          </p>
        ) : null}
        {customer.nextStep && (
          <p className="text-sm text-foreground">
            <span className="font-medium">Next step:</span> {customer.nextStep}
          </p>
        )}
      </CardContent>
    </Card>
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

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="relative">
      <SlidersHorizontal className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-md border border-border bg-surface pl-7 pr-6 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}


function BulkToolbar({
  selectedIds,
  onClear,
  onToggleAll,
  allSelected,
  pipelineStages,
  onBulkAction,
  onExport,
}: {
  selectedIds: Set<string>;
  onClear: () => void;
  onToggleAll: () => void;
  allSelected: boolean;
  pipelineStages: { id: string; name: string }[];
  onBulkAction: (action: "delete" | "set_lifecycle" | "set_priority" | "set_stage", payload: Record<string, unknown>) => void;
  onExport: () => void;
}) {
  const [lifecycle, setLifecycle] = useState<Customer["lifecycleStage"]>("new");
  const [priority, setPriority] = useState<Customer["priority"]>("medium");
  const [stageId, setStageId] = useState<string>(pipelineStages[0]?.id ?? "");

  if (selectedIds.size === 0) {
    return (
      <div className="mt-6 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={allSelected} onChange={onToggleAll} className="h-4 w-4 accent-secondary" />
        <span className="text-sm text-foreground">{selectedIds.size} selected</span>
        <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={lifecycle}
          onChange={(e) => setLifecycle(e.target.value as Customer["lifecycleStage"])}
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        >
          {["new", "contacted", "qualified", "meeting", "proposal", "customer", "lost", "archived"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => onBulkAction("set_lifecycle", { lifecycleStage: lifecycle })}>
          Set lifecycle
        </Button>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Customer["priority"])}
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        >
          {["low", "medium", "high"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => onBulkAction("set_priority", { priority })}>
          Set priority
        </Button>
        {pipelineStages.length > 0 && (
          <>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
            >
              {pipelineStages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={() => onBulkAction("set_stage", { pipelineStageId: stageId })}>
              Set stage
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={() => onBulkAction("delete", {})}>
          <Trash2 className="mr-1 h-4 w-4 text-error" />
          Delete
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: { fullName: string; email?: string | null; phone?: string | null; company?: string | null }[]) => void;
}) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rows = JSON.parse(text);
      if (Array.isArray(rows)) {
        onImport(rows);
        setText("");
      }
    } catch {
      alert("Invalid JSON array");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import customers</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder='[{ "fullName": "Jane Doe", "email": "jane@example.com" }]'
            className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <Button type="submit" className="w-full">Import</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
