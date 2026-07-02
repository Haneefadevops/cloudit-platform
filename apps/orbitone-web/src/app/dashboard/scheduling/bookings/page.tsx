"use client";

import { useState } from "react";
import {
  useBookings,
  useCancelBooking,
  useApproveBooking,
  useDeclineBooking,
} from "@/hooks/useScheduling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CalendarX } from "lucide-react";

import type { Booking } from "@/lib/contracts";

export default function BookingsPage() {
  const { data: bookings, isLoading } = useBookings();
  const [filter, setFilter] = useState<"upcoming" | "cancelled" | "all">("upcoming");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const filtered =
    bookings?.filter((b) => {
      if (filter === "upcoming") return ["pending", "confirmed"].includes(b.status);
      if (filter === "cancelled") return b.status === "cancelled";
      return true;
    }) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {(["upcoming", "cancelled", "all"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "secondary" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarX className="mx-auto h-10 w-10 text-muted" />
            <p className="mt-3 text-muted">No {filter} bookings.</p>
            {filter !== "all" && (
              <Button size="sm" variant="outline" className="mt-4" onClick={() => setFilter("all")}>
                View all bookings
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const cancel = useCancelBooking();
  const approve = useApproveBooking();
  const decline = useDeclineBooking();
  const [showCancel, setShowCancel] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState("");

  async function handleCancel() {
    await cancel.mutateAsync({ id: booking.id, reason });
    setShowCancel(false);
    setReason("");
  }

  async function handleApprove() {
    await approve.mutateAsync(booking.id);
  }

  async function handleDecline() {
    await decline.mutateAsync({ id: booking.id, reason });
    setShowDecline(false);
    setReason("");
  }

  const start = new Date(booking.startAt);
  const end = new Date(booking.endAt);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              {booking.meetingType?.title ?? "Meeting"} with {booking.guest?.name}
            </CardTitle>
            <p className="text-sm text-muted">{booking.guest?.email}</p>
          </div>
          <StatusBadge status={booking.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          <p>
            <strong>When:</strong>{" "}
            {start.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: booking.timezone,
            })}{" "}
            {start.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
              timeZone: booking.timezone,
            })}{" "}
            -{" "}
            {end.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
              timeZone: booking.timezone,
            })}
          </p>
          <p>
            <strong>Timezone:</strong> {booking.timezone}
          </p>
        </div>

        {booking.status === "pending" && !showDecline && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              isLoading={approve.isPending}
              onClick={handleApprove}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              isLoading={decline.isPending}
              onClick={() => setShowDecline(true)}
            >
              Decline
            </Button>
          </div>
        )}

        {showDecline && (
          <div className="space-y-2">
            <Textarea
              placeholder="Reason for declining (optional)"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                isLoading={decline.isPending}
                onClick={handleDecline}
              >
                Confirm decline
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDecline(false);
                  setReason("");
                }}
              >
                Keep booking
              </Button>
            </div>
          </div>
        )}

        {booking.status !== "cancelled" && booking.status !== "pending" && (
          <>
            {!showCancel ? (
              <Button variant="outline" size="sm" onClick={() => setShowCancel(true)}>
                Cancel booking
              </Button>
            ) : (
              <div className="space-y-2">
                <Textarea
                  placeholder="Reason for cancellation (optional)"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={cancel.isPending}
                    onClick={handleCancel}
                  >
                    Confirm cancel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowCancel(false)}>
                    Keep booking
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Booking["status"] }) {
  const variant =
    status === "confirmed"
      ? "success"
      : status === "pending"
      ? "warning"
      : status === "cancelled"
      ? "error"
      : "default";

  return <Badge variant={variant}>{status}</Badge>;
}
