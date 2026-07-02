"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/empty-states";
import type { Event, EventAttendee } from "@/lib/contracts";
import { ArrowLeft, Calendar, MapPin, Users, ArrowRight, Calendar as CalendarIcon } from "lucide-react";

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    async function load() {
      const [eventResult, attendeesResult] = await Promise.all([
        apiFetch<Event>(`/events/${eventId}`),
        apiFetch<EventAttendee[]>(`/events/${eventId}/check-ins`),
      ]);

      if (!eventResult.ok) {
        setStatus("error");
        setError(eventResult.error);
        return;
      }

      const eventData = eventResult.data;
      setEvent(eventData);
      setAttendees(attendeesResult.ok ? attendeesResult.data : []);
      setName(eventData.name);
      setDescription(eventData.description || "");
      setLocation(eventData.location || "");
      setStartsAt(toDatetimeLocal(eventData.startsAt));
      setEndsAt(eventData.endsAt ? toDatetimeLocal(eventData.endsAt) : "");
      setIsPublished(eventData.isPublished);
      setStatus("success");
    }

    load();
  }, [eventId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    setIsSaving(true);

    const result = await apiFetch<Event>(`/events/${eventId}`, {
      method: "PUT",
      body: JSON.stringify({
        name,
        slug: event.slug,
        description: description || null,
        location: location || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        isPublished,
      }),
    });

    if (result.ok) {
      setEvent(result.data);
      setIsEditing(false);
    }

    setIsSaving(false);
  }

  if (status === "loading") {
    return <LoadingState message="Loading event..." />;
  }

  if (status === "error" || !event) {
    return (
      <ErrorState
        title="Could not load event"
        message={error || "This event could not be found."}
        action={
          <Link href="/dashboard/events">
            <Button>Back to events</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-2xl">{event.name}</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                {event.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {event.location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(event.startsAt).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "Cancel" : "Edit"}
              </Button>
              <Link href={`/e/${event.slug}`} target="_blank">
                <Button>Public page</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="name">Event name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="flex w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="startsAt">Starts at</Label>
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endsAt">Ends at</Label>
                  <Input
                    id="endsAt"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-border pt-4">
                <Switch
                  label={isPublished ? "Published" : "Draft"}
                  checked={isPublished}
                  onCheckedChange={setIsPublished}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" isLoading={isSaving}>
                  Save changes
                </Button>
              </div>
            </form>
          ) : (
            <p className="whitespace-pre-wrap text-foreground">
              {event.description || "No description provided."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-secondary" />
            Attendees ({attendees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendees.length === 0 ? (
            <EmptyState
              title="No check-ins yet"
              message="Share the public event page so attendees can check in and network."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {attendees.map((attendee) => (
                <AttendeeCard key={attendee.profile.id} attendee={attendee} eventId={event.id} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AttendeeCard({ attendee, eventId }: { attendee: EventAttendee; eventId: string }) {
  const { profile, connectionStatus, checkedInAt } = attendee;

  const statusLabel: Record<typeof connectionStatus, string> = {
    none: "Not connected",
    saved: "Saved by you",
    saved_me: "Saved you",
    mutual: "Mutual connection",
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-3 p-4">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={profile.fullName}
            className="h-12 w-12 rounded-2xl object-cover"
          />
        ) : (
          <Avatar initials={profile.fullName} alt={profile.fullName} size="lg" />
        )}
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-foreground">
            {profile.fullName}
          </h4>
          {profile.headline && (
            <p className="truncate text-sm text-muted">{profile.headline}</p>
          )}
          <p className="mt-1 text-xs text-muted">
            Checked in {new Date(checkedInAt).toLocaleString()}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Badge variant="secondary">{statusLabel[connectionStatus]}</Badge>
            <Link href={`/u/${profile.slug}`}>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                View <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Link href={`/book/${profile.slug}?eventId=${eventId}`}>
              <Button variant="outline" size="sm" className="h-8 px-2">
                <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                Book meeting
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function toDatetimeLocal(isoString: string): string {
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}
