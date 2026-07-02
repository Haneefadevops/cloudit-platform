import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBookings } from "@/hooks/useScheduling";
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Video, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Booking } from "@/lib/contracts";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarPage() {
  const { data: bookings = [], isLoading } = useBookings();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [year, month]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const dateKey = new Date(booking.startAt).toDateString();
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(booking);
    }
    return map;
  }, [bookings]);

  const selectedBookings = selectedDate
    ? bookingsByDate.get(selectedDate.toDateString()) ?? []
    : [];

  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter((b) => ["pending", "confirmed"].includes(b.status))
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        .slice(0, 5),
    [bookings]
  );

  const navigateMonth = (offset: number) => {
    setCurrentDate(new Date(year, month + offset, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  if (isLoading) {
    return <CalendarSkeleton />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {MONTHS[month]} {year}
            </h2>
            <p className="text-sm text-muted">Meetings and bookings</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button size="sm" variant="outline" onClick={goToToday}>
              Today
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-widest text-muted sm:gap-2 sm:text-xs">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1.5 sm:py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="aspect-square rounded-2xl" />;
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            const dayBookings = bookingsByDate.get(date.toDateString()) ?? [];
            const hasConfirmed = dayBookings.some((b) => b.status === "confirmed");
            const hasPending = dayBookings.some((b) => b.status === "pending");

            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-start rounded-2xl border p-2 transition-all",
                  isSelected
                    ? "border-secondary bg-secondary/10"
                    : "border-border/40 bg-surface-elevated/30 hover:border-secondary/30 hover:bg-surface-elevated/50"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium sm:h-7 sm:w-7 sm:text-sm",
                    isToday && "bg-secondary text-secondary-foreground",
                    !isToday && "text-foreground"
                  )}
                >
                  {date.getDate()}
                </span>
                <div className="mt-auto flex gap-1">
                  {hasConfirmed && <span className="h-1.5 w-1.5 rounded-full bg-secondary" />}
                  {hasPending && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  {dayBookings.some((b) => b.status === "cancelled") && (
                    <span className="h-1.5 w-1.5 rounded-full bg-error" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-secondary" /> Confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" /> Pending
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-error" /> Cancelled
          </span>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted">
            {selectedDate ? selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Upcoming"}
            </CardTitle>
          </CardHeader>
          <CardContent>
          {(selectedDate ? selectedBookings : upcomingBookings).length > 0 ? (
            <ul className="space-y-3">
              {(selectedDate ? selectedBookings : upcomingBookings).map((booking) => (
                <BookingListItem key={booking.id} booking={booking} />
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl bg-surface-elevated/40 p-6 text-center">
              <Calendar className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-2 text-sm text-muted">
                {selectedDate ? "No bookings on this day." : "No upcoming bookings."}
              </p>
            </div>
          )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted">
            Quick filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedDate(new Date())}>
                Today
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/dashboard/scheduling/bookings">All bookings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BookingListItem({ booking }: { booking: Booking }) {
  const start = new Date(booking.startAt);
  const end = new Date(booking.endAt);
  const LocationIcon =
    booking.meetingType?.locationType === "video"
      ? Video
      : booking.meetingType?.locationType === "phone"
      ? Phone
      : MapPin;

  return (
    <li className="flex items-start gap-3 rounded-2xl bg-surface-elevated/40 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
        <User className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-foreground">{booking.guest?.name ?? "Guest"}</p>
          <Badge
            variant={
              booking.status === "confirmed" ? "success" : booking.status === "pending" ? "warning" : "error"
            }
            className="text-[10px]"
          >
            {booking.status}
          </Badge>
        </div>
        <p className="text-xs text-muted">{booking.meetingType?.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} -
            {end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </span>
          <span className="flex items-center gap-1">
            <LocationIcon className="h-3 w-3" />
            {booking.meetingType?.locationType.replace("_", " ")}
          </span>
        </div>
      </div>
    </li>
  );
}

function CalendarSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Skeleton className="h-[32rem] rounded-3xl lg:col-span-2" />
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}
