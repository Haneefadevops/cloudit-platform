"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, CardContent, buttonVariants } from "@cloudit/ui";
import { CalendarDays, DoorOpen, MapPin, Phone } from "lucide-react";
import { formatDate, formatLkr } from "@/lib/format";
import type { PublicBookingPortal } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-hospitality.cloudit.lk";

async function publicApi<T>(url: string): Promise<T> {
  const response = await fetch(`${API_URL}/api${url}`, {
    headers: { "Content-Type": "application/json" },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.message || json.error || `HTTP ${response.status}`);
  }
  return json.data ?? json;
}

const statusVariant: Record<string, string> = {
  pending: "secondary",
  confirmed: "default",
  checked_in: "default",
  checked_out: "secondary",
  cancelled: "destructive",
  no_show: "outline",
};

export default function GuestPortalPage({ params }: { params: { token: string } }) {
  const [portal, setPortal] = useState<PublicBookingPortal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPortal();
  }, [params.token]);

  async function loadPortal() {
    try {
      setIsLoading(true);
      setError("");
      const data = await publicApi<PublicBookingPortal>(`/public/bookings/${params.token}`);
      setPortal(data);
    } catch (loadError: any) {
      setError(loadError?.message || "Unable to load guest portal");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Loading guest portal...</p>
      </main>
    );
  }

  if (error || !portal) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center text-sm text-destructive">
            {error || "Guest portal unavailable"}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">{portal.property.name}</p>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-2xl font-semibold">
                Welcome, {portal.guest.firstName}
              </h1>
              <p className="text-sm text-muted-foreground">
                Reservation {portal.reservation.reservationNumber}
              </p>
            </div>
            <Badge variant={statusVariant[portal.reservation.status] as any}>
              {portal.reservation.status.replace("_", " ")}
            </Badge>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <section className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Check-in</p>
                    <p className="font-medium">{formatDate(portal.reservation.checkInDate)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Check-out</p>
                    <p className="font-medium">{formatDate(portal.reservation.checkOutDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DoorOpen className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Room {portal.room.roomNumber}, {portal.room.roomType}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {portal.reservation.adults} adult(s), {portal.reservation.children} child(ren)
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span>{formatLkr(portal.reservation.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span>{formatLkr(portal.reservation.paidAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-3 font-medium">
                  <span>Balance</span>
                  <span>{formatLkr(portal.reservation.balance)}</span>
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-4 text-sm">
                <h2 className="font-semibold">Property</h2>
                {portal.property.address && (
                  <div className="flex gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span>{portal.property.address}</span>
                  </div>
                )}
                {portal.property.phone && (
                  <div className="flex gap-2">
                    <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span>{portal.property.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4">
                <Link
                  className={buttonVariants({ className: "w-full" })}
                  href={portal.links.selfCheckIn}
                >
                  Self Check-in
                </Link>
                <Link
                  className={buttonVariants({ variant: "outline", className: "w-full" })}
                  href={portal.links.selfCheckOut}
                >
                  Self Check-out
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
