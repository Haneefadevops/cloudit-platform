"use client";

import Link from "next/link";
import {
  Check,
  Clock,
  Calendar,
  Download,
  Share2,
  CalendarClock,
  CalendarX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Booking, MeetingType, PublicProfile } from "@/lib/contracts";
import { LocationIcon, formatDateLong, formatTime, userTimezone } from "./utils";

interface BookingConfirmationProps {
  booking: Booking;
  meetingType: MeetingType;
  profile: PublicProfile;
  guestTokens?: {
    reschedule: string;
    cancel: string;
  };
  profileSlug: string;
  meetingTypeSlug: string;
  timezone?: string;
  onReset: () => void;
}

export function BookingConfirmation({
  booking,
  meetingType,
  profile,
  guestTokens,
  profileSlug,
  meetingTypeSlug,
  timezone = userTimezone,
  onReset,
}: BookingConfirmationProps) {
  const start = new Date(booking.startAt);
  const end = new Date(booking.endAt);
  const tz = booking.timezone || timezone;
  const isPending = booking.status === "pending";

  return (
    <div className="space-y-5">
      <div
        className={[
          "rounded-2xl border p-6 text-center",
          isPending
            ? "border-warning/20 bg-warning-subtle"
            : "border-success/20 bg-success-subtle",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md",
            isPending ? "bg-warning" : "bg-success",
          ].join(" ")}
        >
          {isPending ? (
            <Clock className="h-7 w-7" />
          ) : (
            <Check className="h-7 w-7" />
          )}
        </div>
        <h3 className="mt-4 text-xl font-bold text-foreground">
          {isPending ? "Booking request sent" : "Booking confirmed"}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {isPending
            ? `${profile.fullName} will review and confirm your request.`
            : "A calendar invitation will be sent to your email."}
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <h4 className="text-lg font-semibold text-foreground">
            {meetingType.title}
          </h4>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center gap-3 text-muted">
              <Calendar className="h-4 w-4 text-secondary" />
              {formatDateLong(start, tz)}
            </div>
            <div className="flex items-center gap-3 text-muted">
              <Clock className="h-4 w-4 text-secondary" />
              {formatTime(start, tz)} – {formatTime(end, tz)} · {tz}
            </div>
            <div className="flex items-center gap-3 text-muted">
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
          </div>
        </CardContent>
      </Card>

      {guestTokens && (
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/book/${profileSlug}/${meetingTypeSlug}/reschedule?token=${encodeURIComponent(
              guestTokens.reschedule
            )}`}
          >
            <Button variant="outline" className="w-full">
              <CalendarClock className="h-4 w-4" />
              Reschedule
            </Button>
          </Link>
          <Link
            href={`/book/${profileSlug}/${meetingTypeSlug}/cancel?token=${encodeURIComponent(
              guestTokens.cancel
            )}`}
          >
            <Button variant="outline" className="w-full">
              <CalendarX className="h-4 w-4" />
              Cancel
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Button
          variant="outline"
          onClick={() => console.log("TODO: generate Google Calendar invite link")}
        >
          <Calendar className="h-4 w-4" />
          Add to Google Calendar
        </Button>
        <Button
          variant="outline"
          onClick={() => console.log("TODO: generate .ics file download")}
        >
          <Download className="h-4 w-4" />
          Download .ics
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            console.log("TODO: share booking confirmation on WhatsApp")
          }
        >
          <Share2 className="h-4 w-4" />
          Share on WhatsApp
        </Button>
      </div>

      <Button onClick={onReset} variant="secondary" className="w-full">
        Book another time
      </Button>
    </div>
  );
}
