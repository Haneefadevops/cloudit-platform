import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  usePublicBookingProfile,
  usePublicBookingSlots,
  useCreatePublicBooking,
} from "@/hooks/usePublicBooking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { MeetingType } from "@/lib/contracts";
import {
  CalendarDays,
  Clock,
  MapPin,
  Video,
  Phone,
  User,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

const guestSchema = z.object({
  guestName: z.string().min(1, "Name is required").max(120),
  guestEmail: z.string().email("Valid email is required").max(254),
  guestCompany: z.string().max(120).optional(),
  guestMessage: z.string().max(1000).optional(),
});

type GuestFormValues = z.infer<typeof guestSchema>;

function formatDateLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTimeLabel(iso: string, timezone: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getSlotDates(from: Date, days: number) {
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(addDays(from, i));
  }
  return dates;
}

export function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get("type") ?? undefined;
  const { data: publicBookingProfile, isLoading, error } = usePublicBookingProfile(slug ?? "");

  const meetingTypes = publicBookingProfile?.meetingTypes ?? [];
  const activeMeetingTypes = meetingTypes.filter((mt) => mt.isActive);
  const selectedMeetingType =
    activeMeetingTypes.find((mt) => mt.slug === typeParam) ?? activeMeetingTypes[0];

  return (
    <div className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {isLoading ? (
          <BookingSkeleton />
        ) : error || !publicBookingProfile ? (
          <BookingNotFound slug={slug ?? ""} />
        ) : (
          <BookingShell
            slug={slug ?? ""}
            profile={publicBookingProfile.profile}
            meetingTypes={activeMeetingTypes}
            selectedMeetingType={selectedMeetingType}
            onSelectMeetingType={(mt) => {
              setSearchParams({ type: mt.slug });
            }}
          />
        )}
      </div>
    </div>
  );
}

function BookingSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  );
}

function BookingNotFound({ slug }: { slug: string }) {
  return (
    <GlassCard className="text-center">
      <h2 className="text-xl font-semibold text-foreground">Booking page not found</h2>
      <p className="mt-2 text-muted">
        This host is not accepting bookings right now, or the page does not exist.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button variant="outline" asChild>
          <Link to={`/p/${slug}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            View profile
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </GlassCard>
  );
}

function BookingShell({
  slug,
  profile,
  meetingTypes,
  selectedMeetingType,
  onSelectMeetingType,
}: {
  slug: string;
  profile: { fullName: string; headline: string | null; avatarUrl: string | null };
  meetingTypes: MeetingType[];
  selectedMeetingType: MeetingType | undefined;
  onSelectMeetingType: (mt: MeetingType) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar src={profile.avatarUrl} fallback={profile.fullName} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-primary">{profile.fullName}</h1>
          {profile.headline && <p className="text-muted">{profile.headline}</p>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Book a meeting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {meetingTypes.length === 0 ? (
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">No open meeting types</p>
              <p className="mt-1 text-sm text-muted">
                This host has not set up any bookable meetings yet.
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <Link to={`/p/${slug}`}>Back to profile</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Select a meeting type</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {meetingTypes.map((mt) => (
                    <MeetingTypeCard
                      key={mt.id}
                      meetingType={mt}
                      isSelected={mt.id === selectedMeetingType?.id}
                      onClick={() => onSelectMeetingType(mt)}
                    />
                  ))}
                </div>
              </div>

              {selectedMeetingType && <BookingFlow key={selectedMeetingType.id} meetingType={selectedMeetingType} />}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MeetingTypeCard({
  meetingType,
  isSelected,
  onClick,
}: {
  meetingType: MeetingType;
  isSelected: boolean;
  onClick: () => void;
}) {
  const LocationIcon =
    meetingType.locationType === "video"
      ? Video
      : meetingType.locationType === "phone"
      ? Phone
      : meetingType.locationType === "in_person"
      ? MapPin
      : User;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
        isSelected
          ? "border-secondary bg-secondary/5"
          : "border-border bg-surface-elevated hover:border-secondary/50"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-semibold text-foreground">{meetingType.title}</span>
        <Badge variant="secondary">{meetingType.durationMinutes} min</Badge>
      </div>
      {meetingType.description && (
        <p className="text-sm text-muted">{meetingType.description}</p>
      )}
      <div className="flex items-center gap-4 text-sm text-muted">
        <span className="flex items-center gap-1">
          <LocationIcon className="h-3.5 w-3.5" />
          {meetingType.locationType.replace("_", " ")}
        </span>
      </div>
    </button>
  );
}

function BookingFlow({ meetingType }: { meetingType: MeetingType }) {
  const { slug } = useParams<{ slug: string }>();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = useMemo(() => new Date(), []);
  const dates = useMemo(() => getSlotDates(today, 14), [today]);
  const [selectedDate, setSelectedDate] = useState<Date>(dates[0]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const from = useMemo(() => dates[0].toISOString(), [dates]);
  const to = useMemo(() => addDays(dates[dates.length - 1], 1).toISOString(), [dates]);

  const { data: slotsData, isLoading: slotsLoading } = usePublicBookingSlots(
    slug ?? "",
    meetingType.slug,
    from,
    to,
    timezone
  );

  const slotsForDate = useMemo(() => {
    if (!slotsData) return [];
    const dateStr = selectedDate.toLocaleDateString("en-CA", { timeZone: timezone });
    return slotsData.slots.filter((slot) => {
      const slotDate = new Date(slot.startAt).toLocaleDateString("en-CA", { timeZone: timezone });
      return slotDate === dateStr && slot.available;
    });
  }, [slotsData, selectedDate, timezone]);

  const createBooking = useCreatePublicBooking();

  const form = useForm<GuestFormValues>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      guestName: "",
      guestEmail: "",
      guestCompany: "",
      guestMessage: "",
    },
  });

  async function onSubmit(values: GuestFormValues) {
    if (!selectedSlot) return;
    await createBooking.mutateAsync({
      slug: slug ?? "",
      meetingTypeSlug: meetingType.slug,
      input: {
        ...values,
        startAt: selectedSlot,
        timezone,
      },
    });
    setConfirmed(true);
  }

  if (confirmed && createBooking.data) {
    const booking = createBooking.data.booking;
    return (
      <ConfirmationCard
        booking={booking}
        guestTokens={createBooking.data.guestTokens}
        profileName={createBooking.data.profile.fullName}
      />
    );
  }

  return (
    <div className="space-y-6 border-t border-border pt-6">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Select a date
        </Label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dates.map((date) => {
            const iso = toISODate(date);
            const isSelected = toISODate(selectedDate) === iso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "flex min-w-[4.5rem] flex-col items-center rounded-lg border p-2 text-sm transition-colors",
                  isSelected
                    ? "border-secondary bg-secondary text-secondary-foreground"
                    : "border-border bg-surface-elevated hover:border-secondary/50"
                )}
              >
                <span className="text-xs uppercase opacity-80">
                  {date.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className="text-lg font-semibold">{date.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Available times
        </Label>
        {slotsLoading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : slotsForDate.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface-elevated p-4 text-center text-sm text-muted">
            No available times on {formatDateLabel(selectedDate)}.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slotsForDate.map((slot) => {
              const isSelected = selectedSlot === slot.startAt;
              return (
                <button
                  key={slot.startAt}
                  type="button"
                  onClick={() => setSelectedSlot(slot.startAt)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    isSelected
                      ? "border-secondary bg-secondary text-secondary-foreground"
                      : "border-border bg-surface-elevated hover:border-secondary/50"
                  )}
                >
                  {formatTimeLabel(slot.startAt, timezone)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedSlot && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 border-t border-border pt-6">
          <div className="space-y-2">
            <Label htmlFor="guestName">Your name</Label>
            <Input id="guestName" {...form.register("guestName")} />
            {form.formState.errors.guestName && (
              <p className="text-sm text-error">{form.formState.errors.guestName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="guestEmail">Email</Label>
            <Input id="guestEmail" type="email" {...form.register("guestEmail")} />
            {form.formState.errors.guestEmail && (
              <p className="text-sm text-error">{form.formState.errors.guestEmail.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="guestCompany">Company (optional)</Label>
            <Input id="guestCompany" {...form.register("guestCompany")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guestMessage">Message (optional)</Label>
            <Textarea id="guestMessage" rows={3} {...form.register("guestMessage")} />
          </div>

          {createBooking.isError && (
            <div className="rounded-lg border border-error bg-error/5 p-4 text-sm">
              <p className="text-error">{createBooking.error?.message ?? "Could not book meeting."}</p>
              {createBooking.error?.message?.includes("Upgrade to Pro") && (
                <Button variant="secondary" size="sm" className="mt-3" asChild>
                  <Link to="/dashboard/upgrade">Upgrade to Pro</Link>
                </Button>
              )}
            </div>
          )}

          <Button type="submit" isLoading={createBooking.isPending} size="lg" className="w-full sm:w-auto">
            Book {meetingType.title}
          </Button>
        </form>
      )}
    </div>
  );
}

function ConfirmationCard({
  booking,
  guestTokens,
  profileName,
}: {
  booking: { startAt: string; endAt: string; timezone: string; status: string; meetingType?: { title: string } };
  guestTokens?: { reschedule: string; cancel: string };
  profileName: string;
}) {
  return (
    <Card className="border-success">
      <CardContent className="space-y-4 p-6 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-success" />
        <div>
          <h2 className="text-xl font-bold text-primary">Booking confirmed</h2>
          <p className="text-muted">
            You&apos;re meeting with {profileName} for {booking.meetingType?.title ?? "a meeting"}.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface-elevated p-4 text-left text-sm">
          <p>
            <strong>Status:</strong> {booking.status}
          </p>
          <p>
            <strong>When:</strong> {formatDateLabel(new Date(booking.startAt))} at{" "}
            {formatTimeLabel(booking.startAt, booking.timezone)} - {formatTimeLabel(booking.endAt, booking.timezone)}
          </p>
          <p>
            <strong>Timezone:</strong> {booking.timezone}
          </p>
        </div>

        {guestTokens && (
          <div className="space-y-2 text-left text-sm text-muted">
            <p>A confirmation email with reschedule and cancel links has been sent to you.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
