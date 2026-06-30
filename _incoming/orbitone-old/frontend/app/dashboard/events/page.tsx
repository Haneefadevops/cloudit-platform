"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/empty-states";
import type { Event } from "@/lib/contracts";
import { Calendar, MapPin, ArrowRight, Plus } from "lucide-react";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    async function load() {
      const result = await apiFetch<Event[]>("/events/me");
      if (result.ok) {
        setEvents(result.data);
        setStatus("success");
      } else {
        setStatus("error");
        setError(result.error);
      }
    }
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);

    const result = await apiFetch<Event>("/events", {
      method: "POST",
      body: JSON.stringify({
        name,
        slug,
        description: description || null,
        location: location || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        isPublished: true,
      }),
    });

    if (result.ok) {
      setEvents((prev) => [result.data, ...prev]);
      setName("");
      setSlug("");
      setDescription("");
      setLocation("");
      setStartsAt("");
      setEndsAt("");
      setShowForm(false);
    }

    setIsCreating(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events</h1>
          <p className="text-muted">
            Host lightweight networking events and share your event profile.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Create event"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create event</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="name">Event name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Startup Meetup Colombo"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="slug">Event URL slug *</Label>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-sm text-muted">
                      orbitone.com/e/
                    </span>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) =>
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                      }
                      required
                      pattern="[a-z0-9-]{3,40}"
                      placeholder="startup-meetup-colombo"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the event..."
                    className="flex w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Colombo, Sri Lanka"
                  />
                </div>
                <div>
                  <Label htmlFor="startsAt">Starts at *</Label>
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
              <div className="flex justify-end">
                <Button type="submit" isLoading={isCreating}>
                  Create event
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {status === "loading" && <LoadingState message="Loading events..." />}

      {status === "error" && (
        <ErrorState
          title="Could not load events"
          message={error || "Unable to load your events."}
          action={
            <Button onClick={() => window.location.reload()}>Try again</Button>
          }
        />
      )}

      {status === "success" && events.length === 0 && !showForm && (
        <EmptyState
          title="No events yet"
          message="Create your first networking event to start connecting attendees."
          action={
            <Button onClick={() => setShowForm(true)}>Create event</Button>
          }
        />
      )}

      {status === "success" && events.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  return (
    <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">{event.name}</h3>
            <p className="text-sm text-muted">
              {new Date(event.startsAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <Badge variant={event.isPublished ? "success" : "warning"}>
            {event.isPublished ? "Published" : "Draft"}
          </Badge>
        </div>

        <div className="space-y-1 text-sm text-muted">
          {event.location && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {event.location}
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {new Date(event.startsAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {event.endsAt &&
              ` - ${new Date(event.endsAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Link href={`/dashboard/events/${event.id}`} className="flex-1">
            <Button variant="outline" className="w-full">
              Manage
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/e/${event.slug}`} target="_blank" className="flex-1">
            <Button className="w-full">Public page</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
