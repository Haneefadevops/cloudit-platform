"use client";

import { useEffect, useState } from "react";
import { api, handleApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RotateCcw, Eye, Send } from "lucide-react";

const EVENT_TYPES = [
  "all",
  "booking.created",
  "booking.updated",
  "booking.cancelled",
  "booking.checked_in",
  "booking.checked_out",
  "invoice.generated",
  "user.created",
  "user.login",
];

const STATUSES = ["all", "pending", "success", "failed"];

export default function EventsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState("all");
  const [status, setStatus] = useState("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchLogs = async (page = meta.page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(meta.limit));
      if (eventType !== "all") params.set("eventType", eventType);
      if (status !== "all") params.set("status", status);

      const res: any = await api.get(`/admin/events?${params.toString()}`);
      setLogs(res.data || []);
      setMeta(res.meta || meta);
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, status]);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res: any = await api.post(`/admin/events/${id}/retry`, {});
      toast.success(res.success ? "Webhook retried successfully" : "Webhook retry failed");
      fetchLogs(meta.page);
    } catch (error) {
      handleApiError(error);
    } finally {
      setRetryingId(null);
    }
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    try {
      const res: any = await api.post("/admin/events/test-webhook", {});
      toast.success(res.message || "Test event sent");
      fetchLogs(meta.page);
    } catch (error) {
      handleApiError(error);
    } finally {
      setTesting(false);
    }
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "success":
        return "default";
      case "failed":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Event Logs</h1>
        <Button onClick={handleTestWebhook} disabled={testing} size="sm">
          <Send className="mr-2 h-4 w-4" />
          {testing ? "Sending..." : "Test Webhook"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-full sm:w-64">
              <label className="text-sm font-medium">Event Type</label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger>
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "all" ? "All events" : type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all" ? "All statuses" : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Webhook URL</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        No event logs found
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.eventType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.webhookUrl || "-"}
                      </TableCell>
                      <TableCell>{log.responseStatus ?? "-"}</TableCell>
                      <TableCell>
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Event Payload</DialogTitle>
                              </DialogHeader>
                              <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4 text-xs">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </DialogContent>
                          </Dialog>
                          {log.status !== "success" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRetry(log.id)}
                              disabled={retryingId === log.id}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {meta.page} of {meta.totalPages} ({meta.total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchLogs(meta.page - 1)}
                    disabled={meta.page <= 1 || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchLogs(meta.page + 1)}
                    disabled={meta.page >= meta.totalPages || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
