"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cloudit/ui";
import { PlugZap, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatsCard } from "@/components/stats-card";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type {
  IntegrationConnection,
  IntegrationProvider,
  IntegrationSummary,
  IntegrationStatus,
  Property,
  PaginatedResponse,
} from "@/lib/types";

const providerOptions = [
  { value: "channel_manager", label: "Booking.com / Agoda" },
  { value: "pos", label: "Restaurant POS" },
];

const channelOptions = [
  { value: "booking_com", label: "Booking.com" },
  { value: "agoda", label: "Agoda" },
  { value: "multi_channel", label: "Booking.com + Agoda" },
];

const posOptions = [
  { value: "restaurant_pos", label: "Restaurant POS" },
  { value: "bar_pos", label: "Bar POS" },
  { value: "spa_pos", label: "Spa POS" },
];

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "error", label: "Error" },
];

const statusBadgeVariant: Record<IntegrationStatus, string> = {
  active: "default",
  inactive: "secondary",
  error: "destructive",
};

const providerLabels: Record<IntegrationProvider, string> = {
  channel_manager: "Booking.com / Agoda",
  pos: "Restaurant POS",
};

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [summary, setSummary] = useState<IntegrationSummary | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [formData, setFormData] = useState<Partial<IntegrationConnection>>({
    provider: "channel_manager",
    status: "active",
    config: { channel: "multi_channel" },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      const [integrationRes, summaryRes, propertyRes] = await Promise.all([
        api.get<IntegrationConnection[] | { data: IntegrationConnection[] }>("/integrations"),
        api.get<IntegrationSummary>("/integrations/summary"),
        api.get<PaginatedResponse<Property>>("/properties?limit=100"),
      ]);
      setConnections(Array.isArray(integrationRes) ? integrationRes : integrationRes.data);
      setSummary(summaryRes);
      setProperties(propertyRes.data);
    } catch (loadError) {
      console.error(loadError);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    if (!formData.name?.trim()) {
      setError("Name is required");
      return;
    }

    try {
      setError("");
      await api.post("/integrations", {
        provider: formData.provider || "channel_manager",
        name: formData.name,
        status: formData.status || "active",
        endpointUrl: formData.endpointUrl || undefined,
        propertyId: formData.propertyId || undefined,
        config: {
          ...(formData.config || {}),
          capability:
            formData.provider === "pos"
              ? "room_charge_posting"
              : "rates_inventory_reservations",
        },
      });
      setFormData({
        provider: "channel_manager",
        status: "active",
        config: { channel: "multi_channel" },
      });
      loadData();
    } catch (createError: any) {
      setError(createError?.message || "Unable to create integration");
    }
  }

  async function handleSync(connection: IntegrationConnection, direction: "pull" | "push" | "bidirectional") {
    try {
      await api.post(`/integrations/${connection.id}/sync`, { direction });
      loadData();
    } catch (syncError) {
      console.error(syncError);
    }
  }

  async function handleDelete(connection: IntegrationConnection) {
    if (!confirm(`Delete integration "${connection.name}"?`)) return;
    try {
      await api.delete(`/integrations/${connection.id}`);
      loadData();
    } catch (deleteError) {
      console.error(deleteError);
    }
  }

  const propertyOptions = [
    { value: "", label: "All Properties" },
    ...properties.map((property) => ({ value: property.id, label: property.name })),
  ];

  function updateConfig(key: string, value: string) {
    setFormData({
      ...formData,
      config: {
        ...(formData.config || {}),
        [key]: value,
      },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Manage channel manager and POS connections" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Connections" value={summary?.summary.totalConnections ?? 0} />
        <StatsCard title="Active" value={summary?.summary.activeConnections ?? 0} />
        <StatsCard title="Channels" value={summary?.summary.channelManagers ?? 0} />
        <StatsCard title="POS Systems" value={summary?.summary.posSystems ?? 0} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
            <Select
              options={providerOptions}
              value={formData.provider || "channel_manager"}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  provider: event.target.value as IntegrationProvider,
                  config:
                    event.target.value === "pos"
                      ? { system: "restaurant_pos" }
                      : { channel: "multi_channel" },
                })
              }
            />
            <Input
              placeholder="Connection name"
              value={formData.name || ""}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              className="lg:col-span-2"
            />
            <Input
              placeholder="Endpoint URL"
              value={formData.endpointUrl || ""}
              onChange={(event) => setFormData({ ...formData, endpointUrl: event.target.value })}
              className="lg:col-span-2"
            />
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              options={propertyOptions}
              value={formData.propertyId || ""}
              onChange={(event) => setFormData({ ...formData, propertyId: event.target.value })}
            />
            <Select
              options={statusOptions}
              value={formData.status || "active"}
              onChange={(event) =>
                setFormData({ ...formData, status: event.target.value as IntegrationStatus })
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {formData.provider === "pos" ? (
              <>
                <Select
                  options={posOptions}
                  value={String(formData.config?.system || "restaurant_pos")}
                  onChange={(event) => updateConfig("system", event.target.value)}
                />
                <Input
                  placeholder="Outlet ID"
                  value={String(formData.config?.outletId || "")}
                  onChange={(event) => updateConfig("outletId", event.target.value)}
                />
              </>
            ) : (
              <>
                <Select
                  options={channelOptions}
                  value={String(formData.config?.channel || "multi_channel")}
                  onChange={(event) => updateConfig("channel", event.target.value)}
                />
                <Input
                  placeholder="Rate plan code"
                  value={String(formData.config?.ratePlanCode || "")}
                  onChange={(event) => updateConfig("ratePlanCode", event.target.value)}
                />
              </>
            )}
            <Input
              placeholder="API key reference"
              value={String(formData.config?.apiKeyRef || "")}
              onChange={(event) => updateConfig("apiKeyRef", event.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : connections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No integrations configured
                    </TableCell>
                  </TableRow>
                ) : (
                  connections.map((connection) => (
                    <TableRow key={connection.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <PlugZap className="h-4 w-4 text-muted-foreground" />
                          {connection.name}
                        </div>
                      </TableCell>
                      <TableCell>{providerLabels[connection.provider]}</TableCell>
                      <TableCell>{connection.property?.name || "All Properties"}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[connection.status] as any}>
                          {connection.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {connection.lastSyncAt ? formatDate(connection.lastSyncAt) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSync(connection, "bidirectional")}
                          >
                            <RefreshCcw className="mr-1 h-3 w-3" />
                            Sync
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(connection)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-medium">Recent Sync Activity</h2>
          {!summary || summary.recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sync activity yet</p>
          ) : (
            <div className="space-y-2">
              {summary.recentLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-1 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{log.connectionName}</p>
                    <p className="text-muted-foreground">{log.summary}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={log.status === "success" ? "default" : "destructive"}>
                      {log.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
