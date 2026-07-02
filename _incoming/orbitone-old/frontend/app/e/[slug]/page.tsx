"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import QRCode from "react-qr-code";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicShell } from "@/components/layout/public-shell";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/empty-states";
import type { PublicEvent, EventAttendee } from "@/lib/contracts";
import {
  MapPin,
  Users,
  Check,
  ArrowRight,
  Share2,
  Copy,
  Clock,
} from "lucide-react";

export default function PublicEventPage() {
  const params = useParams();
  const slug = params.slug as string;
  const auth = useAuth();

  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const result = await apiFetch<PublicEvent>(`/events/${slug}`);
      if (result.ok) {
        setEvent(result.data);
        setStatus("success");
      } else {
        setStatus("error");
        setError(result.error);
      }
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (!event) return;
    const currentEvent = event;
    async function loadAttendees() {
      const result = await apiFetch<EventAttendee[]>(`/events/${currentEvent.id}/check-ins`);
      if (result.ok) {
        setAttendees(result.data);
        const me = result.data.find(
          (a) => auth.user && a.userId === auth.user.id
        );
        if (me) setCheckedIn(true);
      }
    }
    loadAttendees();
  }, [event, auth.user]);

  async function handleCheckIn() {
    if (!event) return;
    setCheckingIn(true);
    const result = await apiFetch(`/events/${slug}/check-ins`, { method: "POST" });
    if (result.ok) {
      setCheckedIn(true);
      const refreshed = await apiFetch<EventAttendee[]>(`/events/${event.id}/check-ins`);
      if (refreshed.ok) setAttendees(refreshed.data);
    }
    setCheckingIn(false);
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/e/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/e/${slug}`;

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl">
        {status === "loading" && <LoadingState message="Loading event..." />}

        {status === "error" && (
          <ErrorState
            title="Event not found"
            message={error || "This event does not exist or is not published yet."}
            action={
              <Link href="/">
                <Button>Go home</Button>
              </Link>
            }
          />
        )}

        {status === "success" && event && (
          <div className="space-y-5">
            <Card className="overflow-hidden">
              <div className="gradient-sunset h-20 w-full" />
              <CardHeader className="relative -mt-8 flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="rounded-2xl border border-border bg-surface p-3 shadow-card">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
                      {new Date(event.startsAt).toLocaleDateString(undefined, {
                        month: "short",
                      })}
                    </span>
                    <span className="text-2xl font-bold text-foreground">
                      {new Date(event.startsAt).toLocaleDateString(undefined, {
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <Badge variant="success" className="self-start sm:self-auto">
                  Live event
                </Badge>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <CardTitle className="text-2xl sm:text-3xl">
                    {event.name}
                  </CardTitle>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                    {event.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-secondary" />
                        {event.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-4 w-4 text-secondary" />
                      {new Date(event.startsAt).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                  {event.description || "No description provided."}
                </p>

                {auth.status === "authenticated" ? (
                  checkedIn ? (
                    <div className="flex items-center justify-center gap-2 rounded-2xl bg-success-subtle p-3 text-center text-sm font-medium text-success">
                      <Check className="h-4 w-4" />
                      You are checked in.
                    </div>
                  ) : (
                    <Button
                      onClick={handleCheckIn}
                      isLoading={checkingIn}
                      variant="gradient"
                      className="w-full"
                    >
                      <Check className="h-5 w-5" />
                      Check in to network
                    </Button>
                  )
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-center">
                    <p className="text-sm font-medium text-foreground">
                      Want to check in?
                    </p>
                    <p className="text-xs text-muted">
                      Sign in with a published OrbitOne profile to check in and see
                      attendees.
                    </p>
                    <Link href="/login" className="mt-3 inline-block">
                      <Button size="sm">Sign in</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Share2 className="h-5 w-5 text-secondary" />
                  Share this event
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center rounded-2xl bg-white p-5 shadow-card">
                  <QRCode value={publicUrl} size={180} />
                </div>
                <Button
                  variant="outline"
                  onClick={handleCopyLink}
                  className="w-full"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy event link"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-secondary" />
                  Attendees ({attendees.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {attendees.length === 0 ? (
                  <EmptyState
                    title="No attendees yet"
                    message="Be the first to check in."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {attendees.map((attendee) => (
                      <AttendeeCard key={attendee.profile.id} attendee={attendee} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PublicShell>
  );
}

function AttendeeCard({ attendee }: { attendee: EventAttendee }) {
  const { profile, connectionStatus } = attendee;

  const statusConfig: Record<typeof connectionStatus, { label: string; variant: "default" | "success" | "warning" | "secondary" }> = {
    none: { label: "Not connected", variant: "default" },
    saved: { label: "Saved by you", variant: "success" },
    saved_me: { label: "Saved you", variant: "warning" },
    mutual: { label: "Mutual connection", variant: "success" },
  };

  const status = statusConfig[connectionStatus];

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-dropdown">
      {profile.avatarUrl ? (
        <Image
          src={profile.avatarUrl}
          alt={profile.fullName}
          width={48}
          height={48}
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-accent text-lg font-bold text-white">
          {profile.fullName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h4 className="truncate font-semibold text-foreground">
          {profile.fullName}
        </h4>
        {profile.headline && (
          <p className="truncate text-sm text-muted">{profile.headline}</p>
        )}
        <Badge variant={status.variant} className="mt-1.5">
          {status.label}
        </Badge>
        <div className="mt-2">
          <Link href={`/u/${profile.slug}`}>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-secondary">
              View profile <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
