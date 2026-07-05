"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { handleApiError } from "@/lib/api-client";
import {
  featureFlagsApi,
  type OrganizationFeatureFlag,
  type SetFeatureFlagInput,
} from "@/lib/onboarding";

interface FeatureFlagPanelProps {
  orgId: string;
  product: string;
  title?: string;
  description?: string;
}

export function FeatureFlagPanel({
  orgId,
  product,
  title = "Feature Flags",
  description = "Toggle product features for this organization.",
}: FeatureFlagPanelProps) {
  const [flags, setFlags] = React.useState<OrganizationFeatureFlag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingIds, setSavingIds] = React.useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const data = await featureFlagsApi.list(orgId, product);
      setFlags(data);
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, [orgId, product]);

  function setSaving(id: string, active: boolean) {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSave(localId: string, input: SetFeatureFlagInput) {
    setSaving(localId, true);
    try {
      await featureFlagsApi.set(orgId, input);
      toast.success(`Feature flag "${input.featureKey}" saved`);
      await load();
    } catch (error) {
      handleApiError(error);
    } finally {
      setSaving(localId, false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("Delete this feature flag?")) return;
    try {
      await featureFlagsApi.remove(orgId, id);
      toast.success("Feature flag removed");
      await load();
    } catch (error) {
      handleApiError(error);
    }
  }

  function handleAdd() {
    const localId = `new-${Date.now()}`;
    setFlags((prev) => [
      ...prev,
      {
        id: localId,
        orgId,
        product,
        featureKey: "",
        enabled: false,
      },
    ]);
  }

  function updateFlag(id: string, patch: Partial<OrganizationFeatureFlag>) {
    setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
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
          Add flag
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : flags.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No feature flags defined yet.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first flag
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {flags.map((flag) => (
              <div
                key={flag.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1">
                  <Input
                    value={flag.featureKey}
                    onChange={(e) =>
                      updateFlag(flag.id, {
                        featureKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                      })
                    }
                    placeholder="feature_key"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(checked) => updateFlag(flag.id, { enabled: checked })}
                    />
                    <span className="text-sm">{flag.enabled ? "Enabled" : "Disabled"}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!flag.featureKey || savingIds.has(flag.id)}
                    onClick={() =>
                      handleSave(flag.id, {
                        product: flag.product,
                        featureKey: flag.featureKey,
                        enabled: flag.enabled,
                      })
                    }
                  >
                    {savingIds.has(flag.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(flag.id)}
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
