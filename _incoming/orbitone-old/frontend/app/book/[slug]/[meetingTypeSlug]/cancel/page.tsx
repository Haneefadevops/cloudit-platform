"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PublicShell } from "@/components/layout/public-shell";
import { LoadingState, ErrorState } from "@/components/empty-states";
import { PublicProfileCard } from "@/components/profile/public-profile-card";
import {
  LocationIcon,
  formatDateLong,
  formatTime,
} from "@/components/booking/utils";
import type { Booking, PublicProfile } from "@/lib/contracts";
import { Calendar, CalendarX, Check, Clock, Loader2 } from "lucide-react";

type CancelView = {
  booking: Booking;
  profile: PublicProfile;
};

export default function GuestCancelPage() {
  const params = useParams();
  const slug = params.slug as string;
  const meetingTypeSlug = params.meetingTypeSlug as string;
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [data, setData] = useState<CancelView | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    () => (token ? "loading" : "error")
  );
  const [error, setError] = useState<string | null>(() =>
    token ? null : "Cancel token is missing."
  );

  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelledRequest = false;

    async function load() {
      if (!token) return;
      const result = await apiFetch<CancelView>(
        `/book/${slug}/${meetingTypeSlug}/cancel?token=${encodeURIComponent(
          token
        )}`
      );

      if (cancelledRequest) return;

      if (result.ok) {
        setData(result.data);
        setStatus("success");
      } else {
        setStatus("error");
        setError(result.error);
      }
    }

    load();
    return () => {
      cancelledRequest = true;
    };
  }, [slug, meetingTypeSlug, token]);

  async function handleCancel() {
    if (!token || !data) return;

    setIsSubmitting(true);
    const result = await apiFetch<Booking>(
      `/book/${slug}/${meetingTypeSlug}/cancel?token=${encodeURIComponent(
        token
      )}`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      }
    );

    if (result.ok) {
      setCancelled(true);
    } else {
      setError(result.error);
    }

    setIsSubmitting(false);
  }

  if (status === "loading" && !data) {
    return (
      <PublicShell className="flex items-center justify-center py-12">
        <LoadingState message="Loading your booking..." />
      </PublicShell>
    );
  }

  if (status === "error" && !data) {
    return (
      <PublicShell className="flex items-center justify-center py-12">
        <ErrorState
          title="Could not load cancellation page"
          message={error || "Something went wrong."}
          action={
            <Link href={`/book/${slug}/${meetingTypeSlug}`}>
              <Button>Back to booking</Button>
            </Link>
          }
        />
      </PublicShell>
    );
  }

  if (!data) {
    return (
      <PublicShell className="flex items-center justify-center py-12">
        <ErrorState
          title="Cancellation page not found"
          message="This cancellation page does not exist or has expired."
          action={
            <Link href={`/book/${slug}/${meetingTypeSlug}`}>
              <Button>Back to booking</Button>
            </Link>
          }
        />
      </PublicShell>
    );
  }

  if (cancelled) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-3xl space-y-5">
          <PublicProfileCard profile={data.profile} variant="compact" />

          <Card>
            <CardContent className="p-5 sm:p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success text-white shadow-md">
                <Check className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-foreground">
                Booking cancelled
              </h3>
              <p className="mt-1 text-sm text-muted">
                Your booking has been cancelled.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link href={`/book/${slug}/${meetingTypeSlug}`}>
                  <Button className="w-full sm:w-auto">
                    Book another time
                  </Button>
                </Link>
                <Link href={`/u/${slug}`}>
                  <Button variant="outline" className="w-full sm:w-auto">
                    Back to profile
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </PublicShell>
    );
  }

  const bookingStart = new Date(data.booking.startAt);
  const bookingEnd = new Date(data.booking.endAt);
  const tz = data.booking.timezone;
  const meetingType = data.booking.meetingType;

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <PublicProfileCard profile={data.profile} variant="compact" />

        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">
              Cancel booking
            </h2>
            <p className="mt-1 text-sm text-muted">
              Are you sure you want to cancel your booking?
            </p>

            <div className="mt-5 rounded-2xl border border-border bg-surface p-4 shadow-card">
              <h3 className="font-semibold text-foreground">
                {meetingType?.title || "Meeting"}
              </h3>
              <div className="mt-3 space-y-2 text-sm text-muted">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-secondary" />
                  {formatDateLong(bookingStart, tz)}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-secondary" />
                  {formatTime(bookingStart, tz)} – {formatTime(bookingEnd, tz)} ·{" "}
                  {tz}
                </div>
                {meetingType && (
                  <div className="flex items-center gap-2">
                    <LocationIcon
                      locationType={meetingType.locationType}
                      className="h-4 w-4 text-secondary"
                    />
                    {meetingType.locationValue ||
                      {
                        video: "Video call",
                        phone: "Phone call",
                        in_person: "In person",
                        custom: "Custom",
                      }[meetingType.locationType]}
                  </div>
                )}
              </div>

              {data.booking.guest && (
                <div className="mt-4 border-t border-border pt-3 text-sm text-muted">
                  <span className="font-medium text-foreground">
                    {data.booking.guest.name}
                  </span>
                  {data.booking.guest.email && (
                    <span className="ml-2">· {data.booking.guest.email}</span>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <Label htmlFor="cancel-reason">
                  Reason for cancelling (optional)
                </Label>
                <Textarea
                  id="cancel-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Let the host know why you're cancelling"
                />
              </div>

              {error && <p className="text-sm text-error">{error}</p>}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/book/${slug}/${meetingTypeSlug}`}
                  className="sm:flex-1"
                >
                  <Button variant="outline" className="w-full">
                    Keep booking
                  </Button>
                </Link>
                <Button
                  variant="danger"
                  onClick={handleCancel}
                  isLoading={isSubmitting}
                  className="sm:flex-1"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarX className="h-4 w-4" />
                  )}
                  Cancel booking
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
