"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/empty-states";
import type { Booking, BookingStatus } from "@/lib/contracts";
import {
  Calendar,
  CalendarX,
  Check,
  Clock,
  MapPin,
  Video,
  Phone,
  Link as LinkIcon,
  RotateCcw,
  X,
} from "lucide-react";

type BookingTab = "all" | "upcoming" | "pending" | "past" | "cancelled";

const tabs: { key: BookingTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "pending", label: "Pending approval" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BookingTab>("upcoming");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { show } = useToast();

  useEffect(() => {
    async function load() {
      const result = await apiFetch<Booking[]>("/scheduling/bookings");
      if (result.ok) {
        setBookings(result.data);
        setStatus("success");
      } else {
        setStatus("error");
        setError(result.error);
      }
    }

    load();
  }, []);

  const now = new Date().toISOString();

  const filtered = useMemo(() => {
    switch (activeTab) {
      case "upcoming":
        return bookings.filter(
          (b) =>
            (b.status === "confirmed" || b.status === "pending") &&
            b.startAt >= now
        );
      case "pending":
        return bookings.filter((b) => b.status === "pending");
      case "past":
        return bookings.filter(
          (b) =>
            (b.status === "confirmed" || b.status === "pending") &&
            b.startAt < now
        );
      case "cancelled":
        return bookings.filter((b) => b.status === "cancelled");
      default:
        return bookings;
    }
  }, [bookings, activeTab, now]);

  async function handleApprove(id: string) {
    setProcessingId(id);
    const result = await apiFetch<Booking>(`/scheduling/bookings/${id}/approve`, {
      method: "POST",
    });

    if (result.ok) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? result.data : b))
      );
      show("Booking approved", "success");
    } else {
      show(`Could not approve booking: ${result.error}`, "error");
    }

    setProcessingId(null);
  }

  async function handleReject(id: string, reason: string) {
    setProcessingId(id);
    const result = await apiFetch<Booking>(`/scheduling/bookings/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    });

    if (result.ok) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? result.data : b))
      );
      show("Booking rejected", "success");
    } else {
      show(`Could not reject booking: ${result.error}`, "error");
    }

    setProcessingId(null);
  }

  async function handleCancel(id: string, reason: string) {
    setProcessingId(id);
    const result = await apiFetch<Booking>(`/scheduling/bookings/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    });

    if (result.ok) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? result.data : b))
      );
      show("Booking cancelled", "success");
    } else {
      show(`Could not cancel booking: ${result.error}`, "error");
    }

    setProcessingId(null);
  }

  async function handleReschedule(
    id: string,
    startAt: string,
    endAt: string,
    timezone: string
  ) {
    setProcessingId(id);
    const result = await apiFetch<Booking>(
      `/scheduling/bookings/${id}/reschedule`,
      {
        method: "POST",
        body: JSON.stringify({ startAt, endAt, timezone }),
      }
    );

    if (result.ok) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? result.data : b))
      );
      show("Booking rescheduled", "success");
    } else {
      show(`Could not reschedule booking: ${result.error}`, "error");
    }

    setProcessingId(null);
  }

  if (status === "loading") {
    return <LoadingState message="Loading bookings..." />;
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Could not load bookings"
        message={error || "Something went wrong."}
        action={
          <Button onClick={() => window.location.reload()}>Try again</Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
        <p className="text-muted">Track and manage your scheduled meetings.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "border-secondary text-secondary"
                : "border-transparent text-muted hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No bookings"
          message={
            activeTab === "upcoming"
              ? "You have no upcoming meetings. Bookings will appear here once visitors schedule time with you."
              : activeTab === "pending"
              ? "No bookings are awaiting your approval."
              : activeTab === "past"
              ? "No past meetings yet."
              : activeTab === "cancelled"
              ? "No cancelled meetings."
              : "No bookings yet."
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              processingId={processingId}
              onApprove={() => handleApprove(booking.id)}
              onReject={(reason) => handleReject(booking.id, reason)}
              onCancel={(reason) => handleCancel(booking.id, reason)}
              onReschedule={(startAt, endAt, timezone) =>
                handleReschedule(booking.id, startAt, endAt, timezone)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  processingId,
  onApprove,
  onReject,
  onCancel,
  onReschedule,
}: {
  booking: Booking;
  processingId: string | null;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onCancel: (reason: string) => void;
  onReschedule: (startAt: string, endAt: string, timezone: string) => void;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [rescheduleStart, setRescheduleStart] = useState(() =>
    toDateTimeLocal(new Date(booking.startAt))
  );

  const isProcessing = processingId === booking.id;
  const start = new Date(booking.startAt);
  const end = new Date(booking.endAt);

  const LocationIcon =
    {
      video: Video,
      phone: Phone,
      in_person: MapPin,
      custom: LinkIcon,
    }[booking.meetingType?.locationType || "video"] || Video;

  const canHostAct =
    booking.status === "pending" || booking.status === "confirmed";

  function handleRescheduleSubmit() {
    const newStart = new Date(rescheduleStart);
    if (Number.isNaN(newStart.getTime())) return;
    const durationMinutes = booking.meetingType?.durationMinutes || 30;
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000);
    onReschedule(
      newStart.toISOString(),
      newEnd.toISOString(),
      booking.timezone
    );
    setShowRescheduleForm(false);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground">
                {booking.meetingType?.title || "Meeting"}
              </h3>
              <BookingStatusBadge status={booking.status} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {booking.guest?.name}
              {booking.guest?.company && ` · ${booking.guest.company}`}
              {booking.guest?.email && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={`mailto:${booking.guest.email}`}
                    className="hover:text-secondary"
                  >
                    {booking.guest.email}
                  </a>
                </>
              )}
            </p>
          </div>
          <div className="text-left text-sm text-muted sm:text-right">
            <p className="flex items-center gap-1.5 font-medium text-foreground sm:justify-end">
              <Calendar className="h-4 w-4" />
              {start.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <p className="flex items-center gap-1.5 sm:justify-end">
              <Clock className="h-4 w-4" />
              {start.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              -{" "}
              {end.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {booking.timezone}
            </p>
          </div>
        </div>

        {booking.meetingType?.locationValue && (
          <p className="flex items-start gap-2 text-sm text-muted">
            <LocationIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-all">
              {booking.meetingType.locationValue}
            </span>
          </p>
        )}

        {booking.cancellationReason && (
          <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">
            <span className="font-medium">Cancellation reason:</span>{" "}
            {booking.cancellationReason}
          </p>
        )}

        {showRescheduleForm && canHostAct && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <Label htmlFor={`reschedule-${booking.id}`}>New start time</Label>
            <Input
              id={`reschedule-${booking.id}`}
              type="datetime-local"
              value={rescheduleStart}
              onChange={(e) => setRescheduleStart(e.target.value)}
              className="mt-1"
            />
            <p className="mt-2 text-xs text-muted">
              Duration stays at {booking.meetingType?.durationMinutes || 30}{" "}
              minutes. Timezone: {booking.timezone}.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowRescheduleForm(false);
                  setRescheduleStart(toDateTimeLocal(new Date(booking.startAt)));
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRescheduleSubmit}
                isLoading={isProcessing}
              >
                <RotateCcw className="h-4 w-4" />
                Reschedule
              </Button>
            </div>
          </div>
        )}

        {showRejectForm && booking.status === "pending" && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <Label htmlFor={`reject-reason-${booking.id}`}>
              Rejection reason (optional)
            </Label>
            <Input
              id={`reject-reason-${booking.id}`}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Let the guest know why"
              className="mt-1"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  onReject(rejectReason);
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
                isLoading={isProcessing}
              >
                <X className="h-4 w-4" />
                Confirm reject
              </Button>
            </div>
          </div>
        )}

        {showCancelForm && canHostAct && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <Label htmlFor={`reason-${booking.id}`}>
              Cancellation reason (optional)
            </Label>
            <Input
              id={`reason-${booking.id}`}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Let the guest know why"
              className="mt-1"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCancelForm(false);
                  setCancelReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  onCancel(cancelReason);
                  setShowCancelForm(false);
                  setCancelReason("");
                }}
                isLoading={isProcessing}
              >
                <CalendarX className="h-4 w-4" />
                Confirm cancel
              </Button>
            </div>
          </div>
        )}

        {!showRejectForm && !showCancelForm && !showRescheduleForm && (
          <div className="flex flex-wrap justify-end gap-2">
            {booking.status === "pending" ? (
              <>
                <Button
                  size="sm"
                  onClick={onApprove}
                  isLoading={isProcessing}
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowRejectForm(true)}
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </>
            ) : canHostAct ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRescheduleForm(true)}
                  disabled={isProcessing}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reschedule
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelForm(true)}
                  disabled={isProcessing}
                  className="text-accent hover:bg-accent/10 hover:text-accent"
                >
                  <CalendarX className="h-4 w-4" />
                  Cancel booking
                </Button>
              </>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const config: Record<
    BookingStatus,
    { label: string; variant: "default" | "success" | "warning" | "outline" }
  > = {
    pending: { label: "Pending", variant: "warning" },
    confirmed: { label: "Confirmed", variant: "success" },
    cancelled: { label: "Cancelled", variant: "outline" },
    rescheduled: { label: "Rescheduled", variant: "default" },
  };

  const { label, variant } = config[status];

  return <Badge variant={variant}>{label}</Badge>;
}

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
