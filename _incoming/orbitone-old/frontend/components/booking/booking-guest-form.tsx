"use client";

import { useState } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { BookingSlot, PublicBookingConfirmation } from "@/lib/contracts";
import {
  formatDateLong,
  formatTime,
  userTimezone,
} from "./utils";

interface BookingGuestFormProps {
  slot: BookingSlot;
  slug: string;
  meetingTypeSlug: string;
  connectionId: string | null;
  eventId: string | null;
  onBack: () => void;
  onBooked: (confirmation: PublicBookingConfirmation) => void;
}

export function BookingGuestForm({
  slot,
  slug,
  meetingTypeSlug,
  connectionId,
  eventId,
  onBack,
  onBooked,
}: BookingGuestFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { show } = useToast();

  const timezone = slot.timezone || userTimezone;
  const start = new Date(slot.startAt);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const result = await apiFetch<PublicBookingConfirmation>(
      `/book/${slug}/${meetingTypeSlug}/bookings`,
      {
        method: "POST",
        body: JSON.stringify({
          guestName: name,
          guestEmail: email,
          guestCompany: company || null,
          guestMessage: message || null,
          startAt: slot.startAt,
          timezone: slot.timezone || userTimezone,
          source: connectionId ? "connection" : eventId ? "event" : "profile",
          connectionId: connectionId || null,
          eventId: eventId || null,
        }),
      }
    );

    if (result.ok) {
      onBooked(result.data);
    } else {
      show(`Booking failed: ${result.error}`, "error");
    }

    setIsSubmitting(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary hover:underline"
      >
        ← Choose a different time
      </button>

      <div className="mb-5 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {formatDateLong(start, timezone)}
            </p>
            <p className="text-sm text-muted">
              {formatTime(start, timezone)} · {timezone}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pb-24 sm:pb-0">
        <div>
          <Label htmlFor="guest-name">Full name</Label>
          <Input
            id="guest-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Jane Doe"
          />
        </div>

        <div>
          <Label htmlFor="guest-email">Email</Label>
          <Input
            id="guest-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="jane@example.com"
          />
        </div>

        <div>
          <Label htmlFor="guest-company" optional>
            Company
          </Label>
          <Input
            id="guest-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            placeholder="Acme Inc."
          />
        </div>

        <div>
          <Label htmlFor="guest-message" optional>
            Message
          </Label>
          <Textarea
            id="guest-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What would you like to discuss?"
          />
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:static sm:inset-auto sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <div className="mx-auto flex max-w-3xl gap-3 sm:mx-0 sm:max-w-none">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
              Confirm booking
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
