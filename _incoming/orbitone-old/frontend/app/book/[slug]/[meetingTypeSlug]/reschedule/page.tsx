"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicShell } from "@/components/layout/public-shell";
import { LoadingState, ErrorState } from "@/components/empty-states";
import { PublicProfileCard } from "@/components/profile/public-profile-card";
import { BookingCalendar } from "@/components/booking/booking-calendar";
import { TimeSlotPicker } from "@/components/booking/time-slot-picker";
import {
  LocationIcon,
  formatDateLong,
  formatTime,
  toDateKey,
  userTimezone,
} from "@/components/booking/utils";
import type {
  Booking,
  BookingSlot,
  MeetingType,
  PublicProfile,
} from "@/lib/contracts";
import { Calendar, Check, Clock, Loader2 } from "lucide-react";

type RescheduleView = {
  booking: Booking;
  profile: PublicProfile;
  meetingType: MeetingType;
  slots: BookingSlot[];
};

export default function GuestReschedulePage() {
  const params = useParams();
  const slug = params.slug as string;
  const meetingTypeSlug = params.meetingTypeSlug as string;
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [data, setData] = useState<RescheduleView | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    () => (token ? "loading" : "error")
  );
  const [error, setError] = useState<string | null>(() =>
    token ? null : "Reschedule token is missing."
  );

  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rescheduledBooking, setRescheduledBooking] = useState<Booking | null>(
    null
  );

  const availableDates = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(
      data.slots
        .filter((s) => s.available)
        .map((s) => toDateKey(new Date(s.startAt), s.timezone || userTimezone))
    );
  }, [data]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function load() {
      if (!token) return;
      const result = await apiFetch<RescheduleView>(
        `/book/${slug}/${meetingTypeSlug}/reschedule?token=${encodeURIComponent(
          token
        )}`
      );

      if (cancelled) return;

      if (result.ok) {
        setData(result.data);
        setStatus("success");
        const bookingStart = new Date(result.data.booking.startAt);
        setViewMonth(bookingStart);
        setSelectedDate(bookingStart);
      } else {
        setStatus("error");
        setError(result.error);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, meetingTypeSlug, token]);

  function handleMonthChange(nextMonth: Date) {
    setViewMonth(nextMonth);
    setSelectedSlot(null);
    setSelectedDate(null);
  }

  async function handleConfirm() {
    if (!selectedSlot || !data || !token) return;

    setIsSubmitting(true);
    const result = await apiFetch<Booking>(
      `/book/${slug}/${meetingTypeSlug}/reschedule?token=${encodeURIComponent(
        token
      )}`,
      {
        method: "POST",
        body: JSON.stringify({
          startAt: selectedSlot.startAt,
          endAt: selectedSlot.endAt,
          timezone: selectedSlot.timezone,
        }),
      }
    );

    if (result.ok) {
      setRescheduledBooking(result.data);
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
          title="Could not load reschedule page"
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
          title="Reschedule page not found"
          message="This reschedule page does not exist or has expired."
          action={
            <Link href={`/book/${slug}/${meetingTypeSlug}`}>
              <Button>Back to booking</Button>
            </Link>
          }
        />
      </PublicShell>
    );
  }

  if (rescheduledBooking) {
    const newStart = new Date(rescheduledBooking.startAt);
    const newEnd = new Date(rescheduledBooking.endAt);
    const tz = rescheduledBooking.timezone;

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
                Booking rescheduled
              </h3>
              <p className="mt-1 text-sm text-muted">
                Your new time has been saved.
              </p>

              <div className="mt-6 rounded-2xl border border-border bg-surface p-4 text-left shadow-card">
                <h4 className="font-semibold text-foreground">
                  {data.meetingType.title}
                </h4>
                <div className="mt-3 space-y-2 text-sm text-muted">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-secondary" />
                    {formatDateLong(newStart, tz)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-secondary" />
                    {formatTime(newStart, tz)} – {formatTime(newEnd, tz)} · {tz}
                  </div>
                </div>
              </div>

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

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <PublicProfileCard profile={data.profile} variant="compact" />

        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">
              Reschedule {data.meetingType.title}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Pick a new time that works for you.
            </p>

            <div className="mt-5 rounded-2xl border border-border bg-surface p-4 shadow-card">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Current booking
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
                <div className="flex items-center gap-2">
                  <LocationIcon
                    locationType={data.meetingType.locationType}
                    className="h-4 w-4 text-secondary"
                  />
                  {data.meetingType.locationValue ||
                    {
                      video: "Video call",
                      phone: "Phone call",
                      in_person: "In person",
                      custom: "Custom",
                    }[data.meetingType.locationType]}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
              <BookingCalendar
                month={viewMonth}
                selectedDate={selectedDate}
                availableDates={availableDates}
                onMonthChange={handleMonthChange}
                onSelectDate={setSelectedDate}
                minDate={new Date()}
              />

              <div>
                <TimeSlotPicker
                  slots={data.slots}
                  selectedDate={selectedDate}
                  selectedSlot={selectedSlot}
                  onSelect={setSelectedSlot}
                  onClear={() => setSelectedSlot(null)}
                  timezone={userTimezone}
                />

                {selectedSlot && (
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedSlot(null)}
                      className="sm:flex-1"
                    >
                      Clear selection
                    </Button>
                    <Button
                      onClick={handleConfirm}
                      isLoading={isSubmitting}
                      className="sm:flex-1"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Calendar className="h-4 w-4" />
                      )}
                      Confirm new time
                    </Button>
                  </div>
                )}

                {error && (
                  <p className="mt-3 text-sm text-error">{error}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
