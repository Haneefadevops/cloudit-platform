"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyProfile } from "@/hooks/useProfile";
import { useMeetingTypes, useBookings } from "@/hooks/useScheduling";
import { ExternalLink, Calendar, List, Clock } from "lucide-react";
import { FREE_BOOKINGS_PER_WEEK } from "@/lib/contracts";

export default function SchedulingPage() {
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { data: meetingTypes, isLoading: meetingTypesLoading } = useMeetingTypes();
  const { data: bookings, isLoading: bookingsLoading } = useBookings();

  const isLoading = profileLoading || meetingTypesLoading || bookingsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const publicBookingUrl = profile?.isPublished
    ? `${window.location.origin}/book/${profile.slug}`
    : null;
  const activeMeetingTypes = meetingTypes?.filter((mt) => mt.isActive) ?? [];
  const upcomingBookings =
    bookings?.filter((b) => ["pending", "confirmed"].includes(b.status)) ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduling overview
          </CardTitle>
          <CardDescription>
            Share your public booking link to start receiving meetings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {publicBookingUrl ? (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="success">Published</Badge>
                <span className="text-sm text-muted">{publicBookingUrl}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={publicBookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open booking page
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(publicBookingUrl)}
                >
                  Copy link
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted">Publish your profile to enable public booking.</p>
              <Button size="sm" asChild>
                <Link href="/dashboard/profile">Publish profile</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <List className="h-4 w-4" />
              Meeting types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{activeMeetingTypes.length}</p>
            <p className="text-sm text-muted">active</p>
            <Button size="sm" variant="outline" className="mt-4 w-full" asChild>
              <Link href="/dashboard/scheduling/meeting-types">Manage</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Weekly hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{upcomingBookings.length}</p>
            <p className="text-sm text-muted">upcoming bookings</p>
            <Button size="sm" variant="outline" className="mt-4 w-full" asChild>
              <Link href="/dashboard/scheduling/availability">Set availability</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Free plan limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{FREE_BOOKINGS_PER_WEEK}</p>
            <p className="text-sm text-muted">bookings per week</p>
            <Button size="sm" variant="outline" className="mt-4 w-full" asChild>
              <Link href="/dashboard/bookings">View bookings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
