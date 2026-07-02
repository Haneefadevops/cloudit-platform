"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/empty-states";
import type {
  Booking,
  CalendarAccount,
  MeetingType,
  Profile,
} from "@/lib/contracts";
import {
  Calendar,
  Clock,
  Video,
  ArrowRight,
  CalendarCheck,
  CalendarX,
} from "lucide-react";

export default function SchedulingPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [profileResult, accountsResult, bookingsResult, meetingTypesResult] =
        await Promise.all([
          apiFetch<Profile>("/profiles/me"),
          apiFetch<CalendarAccount[]>("/scheduling/calendar-accounts"),
          apiFetch<Booking[]>("/scheduling/bookings"),
          apiFetch<MeetingType[]>("/scheduling/meeting-types"),
        ]);

      if (!profileResult.ok) {
        setStatus("error");
        setError(profileResult.error);
        return;
      }
      if (!accountsResult.ok) {
        setStatus("error");
        setError(accountsResult.error);
        return;
      }
      if (!bookingsResult.ok) {
        setStatus("error");
        setError(bookingsResult.error);
        return;
      }
      if (!meetingTypesResult.ok) {
        setStatus("error");
        setError(meetingTypesResult.error);
        return;
      }

      setProfile(profileResult.data);
      setAccounts(accountsResult.data);
      setBookings(bookingsResult.data);
      setMeetingTypes(meetingTypesResult.data);
      setStatus("success");
    }

    load();
  }, []);

  const now = new Date().toISOString();

  const upcoming = useMemo(
    () =>
      bookings
        .filter(
          (b) =>
            b.status !== "cancelled" &&
            b.status !== "rescheduled" &&
            b.startAt >= now
        )
        .sort(
          (a, b) =>
            new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
        ),
    [bookings, now]
  );

  const activeMeetingTypes = useMemo(
    () => meetingTypes.filter((mt) => mt.isActive).length,
    [meetingTypes]
  );

  const connectedAccount = useMemo(
    () => accounts.find((a) => a.isConnected),
    [accounts]
  );

  if (status === "loading") {
    return <LoadingState message="Loading scheduling..." />;
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Could not load scheduling"
        message={error || "Something went wrong."}
        action={
          <Button onClick={() => window.location.reload()}>Try again</Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scheduling</h1>
          <p className="text-muted">
            Manage your availability, meeting types, and bookings.
          </p>
        </div>
        <Link href="/dashboard/scheduling/meeting-types">
          <Button className="w-full sm:w-auto">
            <Clock className="h-4 w-4" />
            Manage meeting types
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarCheck}
          label="Upcoming bookings"
          value={upcoming.length.toString()}
          gradient="from-secondary to-accent-2"
        />
        <StatCard
          icon={Video}
          label="Active meeting types"
          value={activeMeetingTypes.toString()}
          gradient="from-accent-2 to-accent"
        />
        <StatCard
          icon={connectedAccount ? CalendarCheck : CalendarX}
          label="Calendar"
          value={connectedAccount ? "Connected" : "Not connected"}
          valueClassName={connectedAccount ? "text-success" : "text-warning"}
          gradient={connectedAccount ? "from-secondary to-accent" : "from-muted to-muted/70"}
        />
        <StatCard
          icon={Clock}
          label="Total bookings"
          value={bookings.length.toString()}
          gradient="from-accent to-accent-2"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upcoming bookings</CardTitle>
              <Link href="/dashboard/scheduling/bookings">
                <Button variant="ghost" size="sm">
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <EmptyState
                title="No upcoming bookings"
                message="Your confirmed meetings will appear here once visitors start booking time with you."
                action={
                  <Link href="/dashboard/scheduling/availability">
                    <Button variant="outline">Set your availability</Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {upcoming.slice(0, 5).map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calendar status</CardTitle>
            </CardHeader>
            <CardContent>
              {connectedAccount ? (
                <div className="space-y-2">
                  <Badge variant="success">Connected</Badge>
                  <p className="text-sm text-foreground">
                    {connectedAccount.provider === "google"
                      ? "Google Calendar"
                      : "Microsoft Calendar"}
                  </p>
                  {connectedAccount.email && (
                    <p className="text-sm text-muted">
                      {connectedAccount.email}
                    </p>
                  )}
                  <p className="text-xs text-muted">
                    OrbitOne will read busy times and create events on this
                    calendar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Badge variant="warning">Not connected</Badge>
                  <p className="text-sm text-muted">
                    Connect a calendar so OrbitOne can check busy times and
                    create events for bookings.
                  </p>
                  <Link href="/dashboard/scheduling/calendar" className="block">
                    <Button variant="outline" className="w-full">
                      Connect calendar
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/dashboard/scheduling/meeting-types">
                <Button variant="outline" className="w-full justify-start">
                  <Video className="h-4 w-4" />
                  Meeting types
                </Button>
              </Link>
              <Link href="/dashboard/scheduling/availability">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4" />
                  Availability
                </Button>
              </Link>
              <Link href="/dashboard/scheduling/bookings">
                <Button variant="outline" className="w-full justify-start">
                  <CalendarCheck className="h-4 w-4" />
                  Bookings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {profile?.isPublished && meetingTypes.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium text-foreground">
                Share your booking page
              </h3>
              <p className="text-sm text-muted">
                Visitors can book a meeting once public booking goes live.
              </p>
            </div>
            <Link href="/u/[slug]" as={`/u/${profile.slug}`} target="_blank">
              <Button variant="outline">View public profile</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  valueClassName = "",
  gradient,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClassName?: string;
  gradient: string;
}) {
  return (
    <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
            gradient,
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className={["text-lg font-semibold text-foreground", valueClassName].join(" ")}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const start = new Date(booking.startAt);
  const end = new Date(booking.endAt);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground">
            {booking.meetingType?.title || "Meeting"}
          </h3>
          <BookingStatusBadge status={booking.status} />
        </div>
        <p className="text-sm text-muted">
          {booking.guest?.name}
          {booking.guest?.company && ` · ${booking.guest.company}`}
        </p>
      </div>
      <div className="text-left text-sm text-muted sm:text-right">
        <p className="font-medium text-foreground">
          {start.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>
        <p>
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
  );
}

function BookingStatusBadge({
  status,
}: {
  status: Booking["status"];
}) {
  const config: Record<Booking["status"], { label: string; variant: "default" | "success" | "warning" | "outline" }> = {
    pending: { label: "Pending", variant: "warning" },
    confirmed: { label: "Confirmed", variant: "success" },
    cancelled: { label: "Cancelled", variant: "outline" },
    rescheduled: { label: "Rescheduled", variant: "default" },
  };

  const { label, variant } = config[status];

  return <Badge variant={variant}>{label}</Badge>;
}
