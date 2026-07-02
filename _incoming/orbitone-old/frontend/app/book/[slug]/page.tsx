"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicShell } from "@/components/layout/public-shell";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/empty-states";
import { PublicProfileCard } from "@/components/profile/public-profile-card";
import { BookingCalendar } from "@/components/booking/booking-calendar";
import { TimeSlotPicker } from "@/components/booking/time-slot-picker";
import { BookingGuestForm } from "@/components/booking/booking-guest-form";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import {
  LocationIcon,
  locationLabels,
  userTimezone,
  getMonthRange,
  toDateKey,
  addDays,
} from "@/components/booking/utils";
import type {
  BookingSlot,
  MeetingType,
  PublicBookingConfirmation,
  PublicBookingProfile,
  PublicBookingSlots,
} from "@/lib/contracts";
import {
  Calendar,
  Check,
  Clock,
  Loader2,
  MessageCircle,
  ShieldAlert,
} from "lucide-react";

async function trackBookingSlotSelected(profileId: string) {
  try {
    await apiFetch("/analytics/events", {
      method: "POST",
      body: JSON.stringify({
        profileId,
        eventType: "booking_slot_selected",
      }),
    });
  } catch {
    // Analytics tracking is best-effort.
  }
}

export default function PublicBookingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const searchParams = useSearchParams();
  const connectionId = searchParams.get("connectionId");
  const eventId = searchParams.get("eventId");
  const preselectedTypeSlug = searchParams.get("type");

  const [profileData, setProfileData] = useState<PublicBookingProfile | null>(
    null
  );
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const [selectedMeetingType, setSelectedMeetingType] =
    useState<MeetingType | null>(null);

  const [slotsData, setSlotsData] = useState<PublicBookingSlots | null>(null);
  const [slotsStatus, setSlotsStatus] = useState<
    "idle" | "loading" | "error" | "success"
  >("idle");
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [isRefreshingSlots, setIsRefreshingSlots] = useState(false);
  const hasSlotsRef = useRef(false);

  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [confirmation, setConfirmation] =
    useState<PublicBookingConfirmation | null>(null);

  const dateRange = useMemo(() => getMonthRange(viewMonth), [viewMonth]);

  const availableDates = useMemo(() => {
    if (!slotsData) return new Set<string>();
    return new Set(
      slotsData.slots
        .filter((s) => s.available)
        .map((s) => toDateKey(new Date(s.startAt), s.timezone || userTimezone))
    );
  }, [slotsData]);

  // Load profile + meeting types.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await apiFetch<PublicBookingProfile>(`/book/${slug}`);
      if (cancelled) return;

      if (result.ok) {
        setProfileData(result.data);
        setStatus("success");

        const active = result.data.meetingTypes.filter((m) => m.isActive);
        const initial =
          active.find((m) => m.slug === preselectedTypeSlug) || active[0] || null;
        setSelectedMeetingType(initial);
      } else {
        setStatus("error");
        setError(result.error);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, preselectedTypeSlug]);

  // Load slots for selected meeting type.
  useEffect(() => {
    let cancelled = false;

    if (!selectedMeetingType) return;
    const meetingType = selectedMeetingType;

    async function loadSlots() {
      if (hasSlotsRef.current) {
        setIsRefreshingSlots(true);
      } else {
        setSlotsStatus("loading");
      }
      setSlotsError(null);

      const result = await apiFetch<PublicBookingSlots>(
        `/book/${slug}/${meetingType.slug}/slots?from=${encodeURIComponent(
          dateRange.from
        )}&to=${encodeURIComponent(dateRange.to)}&timezone=${encodeURIComponent(
          userTimezone
        )}`
      );

      if (cancelled) return;

      if (result.ok) {
        setSlotsData(result.data);
        hasSlotsRef.current = true;
        setSlotsStatus("success");
        if (!confirmation) {
          const first = result.data.slots.find((s) => s.available);
          setSelectedDate(first ? new Date(first.startAt) : null);
        }
      } else {
        setSlotsStatus("error");
        setSlotsError(result.error);
      }
      setIsRefreshingSlots(false);
    }

    loadSlots();
    return () => {
      cancelled = true;
    };
  }, [slug, selectedMeetingType, dateRange.from, dateRange.to, confirmation]);

  function handleSelectMeetingType(meetingType: MeetingType) {
    if (selectedMeetingType?.id === meetingType.id) return;

    setSelectedMeetingType(meetingType);
    setSlotsData(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setConfirmation(null);
    hasSlotsRef.current = false;

    // Keep the URL in sync without reloading.
    const url = new URL(window.location.href);
    url.searchParams.set("type", meetingType.slug);
    window.history.replaceState({}, "", url.toString());
  }

  function handleMonthChange(nextMonth: Date) {
    setViewMonth(nextMonth);
    setSelectedSlot(null);
  }

  function handleJumpToNextWeek() {
    handleMonthChange(addDays(viewMonth, 7));
  }

  if (status === "loading") {
    return (
      <PublicShell className="flex items-center justify-center py-12">
        <LoadingState message="Loading booking page..." />
      </PublicShell>
    );
  }

  if (status === "error" || !profileData) {
    return (
      <PublicShell className="flex items-center justify-center py-12">
        <ErrorState
          title="Booking page not found"
          message={
            error ||
            "This booking page does not exist or has not been published yet."
          }
          action={
            <Link href="/">
              <Button>Go home</Button>
            </Link>
          }
        />
      </PublicShell>
    );
  }

  const activeMeetingTypes = profileData.meetingTypes.filter((m) => m.isActive);

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <PublicProfileCard profile={profileData.profile} variant="compact" />

        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="mb-5 text-center sm:text-left">
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                Book time with {profileData.profile.fullName}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Choose a meeting type, pick a date, then select a time slot.
              </p>
            </div>

            {activeMeetingTypes.length === 0 ? (
              <EmptyState
                title="No meetings available"
                message="This profile has not set up any bookable meeting types yet. Check back later or reach out directly."
              />
            ) : (
              <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
                {/* Meeting type selector */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Select a meeting
                  </h3>
                  <div className="space-y-2">
                    {activeMeetingTypes.map((meetingType) => (
                      <MeetingTypeOption
                        key={meetingType.id}
                        meetingType={meetingType}
                        selected={selectedMeetingType?.id === meetingType.id}
                        onSelect={() => handleSelectMeetingType(meetingType)}
                      />
                    ))}
                  </div>

                  <div className="rounded-2xl border border-border bg-surface p-3 text-xs text-muted">
                    <span className="font-medium text-foreground">
                      Time zone:
                    </span>{" "}
                    {userTimezone.replace(/_/g, " ")}
                  </div>
                </div>

                {/* Calendar + slots */}
                <div>
                  {!selectedMeetingType ? (
                    <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
                      <Calendar className="mx-auto h-10 w-10 text-muted" />
                      <h3 className="mt-3 font-semibold text-foreground">
                        Select a meeting type
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        Pick a meeting from the list to see available dates.
                      </p>
                    </div>
                  ) : confirmation ? (
                    <BookingConfirmation
                      booking={confirmation.booking}
                      meetingType={selectedMeetingType}
                      profile={profileData.profile}
                      guestTokens={confirmation.guestTokens}
                      profileSlug={slug}
                      meetingTypeSlug={selectedMeetingType.slug}
                      timezone={userTimezone}
                      onReset={() => {
                        setConfirmation(null);
                        setSelectedSlot(null);
                      }}
                    />
                  ) : slotsStatus === "loading" && !slotsData ? (
                    <div className="flex items-center justify-center rounded-2xl border border-border bg-surface py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-secondary" />
                    </div>
                  ) : slotsStatus === "error" && !slotsData ? (
                    <ErrorState
                      title="Could not load availability"
                      message={slotsError || "Something went wrong."}
                      action={
                        <Button onClick={() => window.location.reload()}>
                          Try again
                        </Button>
                      }
                    />
                  ) : !slotsData?.slots.some((s) => s.available) ? (
                    <NoSlotsFallback
                      profile={profileData.profile}
                      onTryNextWeek={handleJumpToNextWeek}
                      isRefreshing={isRefreshingSlots}
                    />
                  ) : (
                    <div className="space-y-5">
                      <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4 shadow-card">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                          <span className="inline-flex items-center gap-1 font-medium text-foreground">
                            <Clock className="h-4 w-4 text-secondary" />
                            {selectedMeetingType.durationMinutes} minutes
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <LocationIcon
                              locationType={selectedMeetingType.locationType}
                              className="h-4 w-4 text-secondary"
                            />
                            {locationLabels[selectedMeetingType.locationType]}
                          </span>
                          {selectedMeetingType.requiresApproval && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning">
                              <ShieldAlert className="h-3 w-3" />
                              Approval required
                            </span>
                          )}
                        </div>
                        {selectedMeetingType.description && (
                          <p className="mt-1 text-sm text-muted">
                            {selectedMeetingType.description}
                          </p>
                        )}
                      </div>

                      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
                        <div className="relative">
                          {isRefreshingSlots && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-surface/80 backdrop-blur">
                              <Loader2 className="h-6 w-6 animate-spin text-secondary" />
                            </div>
                          )}
                          <BookingCalendar
                            month={viewMonth}
                            selectedDate={selectedDate}
                            availableDates={availableDates}
                            onMonthChange={handleMonthChange}
                            onSelectDate={setSelectedDate}
                            minDate={new Date()}
                          />
                        </div>

                        <div>
                          {selectedSlot ? (
                            <BookingGuestForm
                              slot={selectedSlot}
                              slug={slug}
                              meetingTypeSlug={selectedMeetingType.slug}
                              connectionId={connectionId}
                              eventId={eventId}
                              onBack={() => setSelectedSlot(null)}
                              onBooked={setConfirmation}
                            />
                          ) : (
                            <TimeSlotPicker
                              slots={slotsData.slots}
                              selectedDate={selectedDate}
                              selectedSlot={selectedSlot}
                              onSelect={(slot) => {
                                setSelectedSlot(slot);
                                trackBookingSlotSelected(
                                  profileData.profile.id
                                );
                              }}
                              onClear={() => setSelectedSlot(null)}
                              timezone={userTimezone}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}

function MeetingTypeOption({
  meetingType,
  selected,
  onSelect,
}: {
  meetingType: MeetingType;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "w-full rounded-2xl border p-4 text-left transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2",
        selected
          ? "border-secondary bg-secondary/5 shadow-card"
          : "border-border bg-surface hover:-translate-y-0.5 hover:border-secondary/60 hover:shadow-card",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-foreground">
            {meetingType.title}
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5">
              <Clock className="h-3 w-3" />
              {meetingType.durationMinutes} min
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5">
              <LocationIcon locationType={meetingType.locationType} />
              {locationLabels[meetingType.locationType]}
            </span>
          </div>
        </div>
        {selected && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-white">
            <Check className="h-4 w-4" />
          </span>
        )}
      </div>

      {meetingType.description && (
        <p className="mt-2 line-clamp-2 text-left text-sm text-muted">
          {meetingType.description}
        </p>
      )}

      {meetingType.requiresApproval && (
        <p className="mt-2 flex items-center gap-1 text-xs text-warning">
          <ShieldAlert className="h-3.5 w-3.5" />
          Host approval required before confirming
        </p>
      )}
    </button>
  );
}

function NoSlotsFallback({
  profile,
  onTryNextWeek,
  isRefreshing,
}: {
  profile: { fullName: string; phone: string | null };
  onTryNextWeek: () => void;
  isRefreshing: boolean;
}) {
  const waText = encodeURIComponent(
    `Hi ${profile.fullName}, I'd like to book a meeting with you. Could you share a time that works? ${
      typeof window !== "undefined" ? window.location.href : ""
    }`
  );

  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <Calendar className="mx-auto h-10 w-10 text-muted" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">
        No available times
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        There are no open slots for this meeting type in the selected period.
        Try the next week or message {profile.fullName} directly.
      </p>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button
          variant="secondary"
          onClick={onTryNextWeek}
          disabled={isRefreshing}
          isLoading={isRefreshing}
        >
          <Calendar className="h-4 w-4" />
          Try next week
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            window.open(
              `https://wa.me/${
                profile.phone ? profile.phone.replace(/\D/g, "") : ""
              }?text=${waText}`,
              "_blank",
              "noopener,noreferrer"
            )
          }
        >
          <MessageCircle className="h-4 w-4" />
          Message on WhatsApp
        </Button>
      </div>
    </div>
  );
}
