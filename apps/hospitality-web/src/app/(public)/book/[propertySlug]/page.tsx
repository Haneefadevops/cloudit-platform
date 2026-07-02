"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Input, Badge, buttonVariants } from "@cloudit/ui";
import { CalendarDays, MapPin, Phone, Mail } from "lucide-react";
import Link from "next/link";
import { formatLkr } from "@/lib/format";
import type { PublicAvailabilityResult } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-hospitality.cloudit.lk";

async function publicApi<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}/api${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.message || json.error || `HTTP ${response.status}`);
  }
  return json.data ?? json;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function PublicPropertyBookingPage({
  params,
}: {
  params: { propertySlug: string };
}) {
  const [result, setResult] = useState<PublicAvailabilityResult | null>(null);
  const [checkInDate, setCheckInDate] = useState(todayInputValue());
  const [checkOutDate, setCheckOutDate] = useState(tomorrowInputValue());
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProperty();
  }, [params.propertySlug]);

  async function loadProperty() {
    try {
      setIsLoading(true);
      setError("");
      const data = await publicApi<PublicAvailabilityResult>("/public/availability", {
        propertySlug: params.propertySlug,
      });
      setResult(data);
    } catch (loadError: any) {
      setError(loadError?.message || "Unable to load property");
    } finally {
      setIsLoading(false);
    }
  }

  async function searchAvailability() {
    try {
      setIsLoading(true);
      setError("");
      const data = await publicApi<PublicAvailabilityResult>("/public/availability", {
        propertySlug: params.propertySlug,
        checkInDate,
        checkOutDate,
      });
      setResult(data);
      setHasSearched(true);
    } catch (searchError: any) {
      setError(searchError?.message || "Unable to search availability");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading && !result) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Loading property...</p>
      </main>
    );
  }

  if (error && !result) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      </main>
    );
  }

  if (!result) return null;
  const checkoutParams = new URLSearchParams({
    checkInDate,
    checkOutDate,
  });

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-muted/30">
        <div className="mx-auto flex min-h-[42vh] max-w-6xl flex-col justify-end gap-4 px-4 py-8 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              {result.property.name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {result.property.address && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {result.property.address}
                </span>
              )}
              {result.property.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {result.property.phone}
                </span>
              )}
              {result.property.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {result.property.email}
                </span>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Check-in
                </label>
                <Input
                  type="date"
                  value={checkInDate}
                  onChange={(event) => setCheckInDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Check-out
                </label>
                <Input
                  type="date"
                  value={checkOutDate}
                  onChange={(event) => setCheckOutDate(event.target.value)}
                />
              </div>
              <Button onClick={searchAvailability} className="self-end" disabled={isLoading}>
                <CalendarDays className="mr-2 h-4 w-4" />
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </CardContent>
          </Card>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Rooms</h2>
          {hasSearched && (
            <p className="text-sm text-muted-foreground">
              {checkInDate} to {checkOutDate}
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {result.roomTypes.map((roomType) => (
            <Card key={roomType.id}>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{roomType.name}</h3>
                    {roomType.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{roomType.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary">Up to {roomType.maxOccupancy}</Badge>
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="text-xl font-semibold">{formatLkr(roomType.basePrice)}</p>
                  </div>
                  {hasSearched ? (
                    <Badge variant={roomType.availableRooms ? "default" : "outline"}>
                      {roomType.availableRooms || 0} available
                    </Badge>
                  ) : (
                    <Badge variant="outline">{roomType.totalRooms} room(s)</Badge>
                  )}
                </div>

                {hasSearched && !!roomType.availableRooms && (
                  <Link
                    className={buttonVariants({ className: "w-full" })}
                    href={`/book/${params.propertySlug}/checkout?${checkoutParams.toString()}&roomTypeId=${roomType.id}`}
                  >
                    Book {roomType.name}
                  </Link>
                )}

                {!!roomType.seasonalRates.length && (
                  <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                    {roomType.seasonalRates.slice(0, 2).map((rate) => (
                      <p key={`${roomType.id}-${rate.name}-${rate.startDate}`}>
                        {rate.name}: {formatLkr(rate.price)}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
