"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { handleApiError } from "@/lib/api-client";
import {
  customFieldsApi,
  type OrganizationCustomField,
  type UpsertCustomFieldInput,
} from "@/lib/onboarding";

const FIELD_TYPES: OrganizationCustomField["fieldType"][] = [
  "text",
  "number",
  "date",
  "dropdown",
  "checkbox",
];

interface CustomFieldBuilderProps {
  orgId: string;
  product: string;
  entity: string;
  title?: string;
  description?: string;
}

export function CustomFieldBuilder({
  orgId,
  product,
  entity,
  title = "Custom Fields",
  description = "Define extra fields that appear on forms for this organization.",
}: CustomFieldBuilderProps) {
  const [fields, setFields] = React.useState<OrganizationCustomField[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingIds, setSavingIds] = React.useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const data = await customFieldsApi.list(orgId, product, entity);
      setFields(data);
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, [orgId, product, entity]);

  function setSaving(id: string, active: boolean) {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSave(localId: string, input: UpsertCustomFieldInput) {
    setSaving(localId, true);
    try {
      await customFieldsApi.upsert(orgId, input);
      toast.success(`Custom field "${input.fieldLabel}" saved`);
      await load();
    } catch (error) {
      handleApiError(error);
    } finally {
      setSaving(localId, false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("Delete this custom field? This cannot be undone.")) return;
    try {
      await customFieldsApi.remove(orgId, id);
      toast.success("Custom field removed");
      await load();
    } catch (error) {
      handleApiError(error);
    }
  }

  function handleAdd() {
    const localId = `new-${Date.now()}`;
    const newField: OrganizationCustomField & { isNew?: boolean } = {
      id: localId,
      orgId,
      product,
      module: "default",
      entity,
      fieldKey: `custom_${fields.length + 1}`,
      fieldLabel: "",
      fieldType: "text",
      options: null,
      required: false,
      order: fields.length,
      isActive: true,
      isNew: true,
    };
    setFields((prev) => [...prev, newField]);
  }

  function updateField(id: string, patch: Partial<OrganizationCustomField>) {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add field
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : fields.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No custom fields defined yet.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first field
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[auto_1fr_1fr_1fr_auto_auto] sm:items-end"
              >
                <div className="flex h-10 items-center text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                  <span className="ml-1 text-xs">{index + 1}</span>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Label</label>
                  <Input
                    value={field.fieldLabel}
                    onChange={(e) => updateField(field.id, { fieldLabel: e.target.value })}
                    placeholder="e.g. Employee Grade"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Key</label>
                  <Input
                    value={field.fieldKey}
                    onChange={(e) =>
                      updateField(field.id, {
                        fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                      })
                    }
                    placeholder="employee_grade"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <select
                    value={field.fieldType}
                    onChange={(e) =>
                      updateField(field.id, { fieldType: e.target.value as OrganizationCustomField["fieldType"] })
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex h-10 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-primary text-primary"
                    checked={field.required}
                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                  />
                  <span className="text-sm">Required</span>
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!field.fieldLabel || !field.fieldKey || savingIds.has(field.id)}
                    onClick={() =>
                      handleSave(field.id, {
                        product: field.product,
                        module: field.module,
                        entity: field.entity,
                        fieldKey: field.fieldKey,
                        fieldLabel: field.fieldLabel,
                        fieldType: field.fieldType,
                        required: field.required,
                        order: index,
                        isActive: field.isActive,
                      })
                    }
                  >
                    {savingIds.has(field.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(field.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
