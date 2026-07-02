import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCustomFields,
  useCreateCustomField,
  useUpdateCustomField,
  useDeleteCustomField,
  useDefaultPipeline,
  useCreatePipelineStage,
  useUpdatePipelineStage,
  useDeletePipelineStage,
} from "@/hooks/useCRM";
import { ActivityTypesTab } from "./activity-types-tab";
import { TemplatesTab } from "./templates-tab";
import { AutomationTab } from "./automation-tab";
import { WebhooksTab } from "./webhooks-tab";
import type { CustomFieldDefinition, CustomFieldInput, Pipeline, PipelineStageInput } from "@/lib/contracts";
import { ArrowLeft, Plus, Trash2, GripVertical, Pencil, X } from "lucide-react";

const fieldTypeLabels: Record<CustomFieldDefinition["type"], string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  url: "URL",
  email: "Email",
  single_select: "Single select",
  multi_select: "Multi select",
};

export function CRMSettingsPage() {
  const [activeTab, setActiveTab] = useState<"fields" | "pipeline" | "activity-types" | "templates" | "automation" | "webhooks">("fields");

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/dashboard/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-primary">CRM settings</h1>
          <p className="text-muted">Customize fields, pipeline, activity types, templates, automation, and webhooks.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === "fields" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("fields")}
        >
          Custom fields
        </Button>
        <Button
          variant={activeTab === "pipeline" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("pipeline")}
        >
          Pipeline
        </Button>
        <Button
          variant={activeTab === "activity-types" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("activity-types")}
        >
          Activity types
        </Button>
        <Button
          variant={activeTab === "templates" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("templates")}
        >
          Templates
        </Button>
        <Button
          variant={activeTab === "automation" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("automation")}
        >
          Automation
        </Button>
        <Button
          variant={activeTab === "webhooks" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("webhooks")}
        >
          Webhooks
        </Button>
      </div>

      {activeTab === "fields" && <CustomFieldsTab />}
      {activeTab === "pipeline" && <PipelineTab />}
      {activeTab === "activity-types" && <ActivityTypesTab />}
      {activeTab === "templates" && <TemplatesTab />}
      {activeTab === "automation" && <AutomationTab />}
      {activeTab === "webhooks" && <WebhooksTab />}
    </div>
  );
}

function CustomFieldsTab() {
  const { data: fields = [], isLoading } = useCustomFields();
  const create = useCreateCustomField();
  const update = useUpdateCustomField();
  const remove = useDeleteCustomField();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFieldDefinition | null>(null);

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
        <CardTitle>Custom fields</CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add field
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.length === 0 ? (
          <p className="text-sm text-muted">No custom fields yet.</p>
        ) : (
          fields.map((field) => (
            <div
              key={field.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted" />
                <div>
                  <p className="font-medium text-foreground">{field.name}</p>
                  <p className="text-xs text-muted">{field.key} · {fieldTypeLabels[field.type]}</p>
                </div>
                {field.isRequired && <Badge variant="outline">Required</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditing(field); setOpen(true); }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(field.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-4 w-4 text-error" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <CustomFieldDialog
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

function CustomFieldDialog({
  open,
  onOpenChange,
  field,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: CustomFieldDefinition | null;
  onSave: (input: CustomFieldInput) => Promise<void>;
}) {
  const [type, setType] = useState<CustomFieldDefinition["type"]>(field?.type ?? "text");
  const [options, setOptions] = useState<string[]>(field?.options ?? []);
  const [optionInput, setOptionInput] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const key = fd.get("key") as string;
    const isRequired = fd.get("isRequired") === "on";
    await onSave({
      name,
      key,
      type,
      options: ["single_select", "multi_select"].includes(type) ? options : undefined,
      isRequired,
    });
    setOptions([]);
    setOptionInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{field ? "Edit custom field" : "New custom field"}</DialogTitle>
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
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as CustomFieldDefinition["type"])}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="email">Email</option>
              <option value="url">URL</option>
              <option value="single_select">Single select</option>
              <option value="multi_select">Multi select</option>
            </select>
          </div>
          {["single_select", "multi_select"].includes(type) && (
            <div>
              <Label>Options</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {options.map((opt, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1">
                    {opt}
                    <button type="button" onClick={() => setOptions(options.filter((_, i) => i !== idx))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  placeholder="Add option"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (optionInput.trim()) {
                        setOptions([...options, optionInput.trim()]);
                        setOptionInput("");
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (optionInput.trim()) {
                      setOptions([...options, optionInput.trim()]);
                      setOptionInput("");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input id="isRequired" name="isRequired" type="checkbox" defaultChecked={field?.isRequired} />
            <Label htmlFor="isRequired" className="mb-0">Required field</Label>
          </div>
          <Button type="submit" className="w-full">{field ? "Save changes" : "Create field"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PipelineTab() {
  const { data: pipeline, isLoading } = useDefaultPipeline();
  const createStage = useCreatePipelineStage(pipeline?.id);
  const updateStage = useUpdatePipelineStage();
  const deleteStage = useDeletePipelineStage();
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Pipeline["stages"][number] | null>(null);

  if (isLoading || !pipeline) {
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
        <div>
          <CardTitle>{pipeline.name}</CardTitle>
          <p className="text-sm text-muted">Default pipeline stages</p>
        </div>
        <Button size="sm" onClick={() => { setEditingStage(null); setStageDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add stage
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {pipeline.stages.map((stage) => (
          <div
            key={stage.id}
            className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-muted" />
              <div>
                <p className="font-medium text-foreground">{stage.name}</p>
                {stage.probability !== null && (
                  <p className="text-xs text-muted">Probability: {stage.probability}%</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEditingStage(stage); setStageDialogOpen(true); }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const fallback = pipeline.stages.find((s) => s.id !== stage.id)?.id;
                  if (confirm("Delete this stage? Customers in this stage will be moved to another stage.")) {
                    deleteStage.mutate({ stageId: stage.id, fallbackStageId: fallback });
                  }
                }}
                disabled={deleteStage.isPending || pipeline.stages.length <= 1}
              >
                <Trash2 className="h-4 w-4 text-error" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <PipelineStageDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        stage={editingStage}
        onSave={async (input) => {
          if (editingStage) {
            await updateStage.mutateAsync({ id: editingStage.id, ...input });
          } else {
            await createStage.mutateAsync(input);
          }
          setStageDialogOpen(false);
        }}
      />
    </Card>
  );
}

function PipelineStageDialog({
  open,
  onOpenChange,
  stage,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: Pipeline["stages"][number] | null;
  onSave: (input: PipelineStageInput) => Promise<void>;
}) {
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const probability = (fd.get("probability") as string) || null;
    await onSave({
      name,
      probability: probability ? Number(probability) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{stage ? "Edit stage" : "New stage"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="stageName">Name</Label>
            <Input id="stageName" name="name" defaultValue={stage?.name} required />
          </div>
          <div>
            <Label htmlFor="probability">Probability (%)</Label>
            <Input
              id="probability"
              name="probability"
              type="number"
              min={0}
              max={100}
              defaultValue={stage?.probability ?? ""}
            />
          </div>
          <Button type="submit" className="w-full">{stage ? "Save changes" : "Create stage"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
