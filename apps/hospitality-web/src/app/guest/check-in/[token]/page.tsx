"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Input } from "@cloudit/ui";
import { formatDate } from "@/lib/format";
import type { PublicCheckInSession } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-hospitality.cloudit.lk";

async function publicApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/api${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.message || json.error || `HTTP ${response.status}`);
  }
  return json.data ?? json;
}

export default function GuestCheckInPage({ params }: { params: { token: string } }) {
  const [session, setSession] = useState<PublicCheckInSession | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSession();
  }, [params.token]);

  async function loadSession() {
    try {
      setIsLoading(true);
      const data = await publicApi<PublicCheckInSession>(`/guest-portal/check-in/${params.token}`);
      setSession(data);
      setSubmitted(!!data.submittedAt);
      setFormData({
        localPhone: data.reservation.guest.localPhone || data.reservation.guest.phone || "",
        nicNumber: data.reservation.guest.nicNumber || "",
        passportNumber: data.reservation.guest.passportNumber || "",
        nationality: data.reservation.guest.nationality || "",
        address: data.reservation.guest.address || "",
        emergencyContactName: data.reservation.guest.emergencyContactName || "",
        emergencyContactPhone: data.reservation.guest.emergencyContactPhone || "",
      });
    } catch (loadError: any) {
      setError(loadError?.message || "Unable to load check-in link");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    try {
      setIsSubmitting(true);
      setError("");
      await publicApi(`/guest-portal/check-in/${params.token}`, {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setSubmitted(true);
    } catch (submitError: any) {
      setError(submitError?.message || "Unable to submit check-in");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Loading check-in...</p>
      </main>
    );
  }

  if (error && !session) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      </main>
    );
  }

  if (!session) return null;

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">{session.reservation.property.name}</p>
          <h1 className="text-2xl font-semibold">Guest Self Check-in</h1>
        </div>

        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reservation</span>
              <span className="font-medium">{session.reservation.reservationNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Guest</span>
              <span>
                {session.reservation.guest.firstName} {session.reservation.guest.lastName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stay</span>
              <span>
                {formatDate(session.reservation.checkInDate)} - {formatDate(session.reservation.checkOutDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Room</span>
              <span>
                {session.reservation.room.roomNumber}
                {session.reservation.room.roomType ? `, ${session.reservation.room.roomType}` : ""}
              </span>
            </div>
          </CardContent>
        </Card>

        {submitted ? (
          <Card>
            <CardContent className="p-6 text-center">
              <h2 className="text-lg font-semibold">Check-in submitted</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your details have been sent to the property team.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  placeholder="Local phone"
                  value={formData.localPhone || ""}
                  onChange={(event) => setFormData({ ...formData, localPhone: event.target.value })}
                />
                <Input
                  placeholder="Nationality"
                  value={formData.nationality || ""}
                  onChange={(event) => setFormData({ ...formData, nationality: event.target.value })}
                />
                <Input
                  placeholder="NIC number"
                  value={formData.nicNumber || ""}
                  onChange={(event) => setFormData({ ...formData, nicNumber: event.target.value })}
                />
                <Input
                  placeholder="Passport number"
                  value={formData.passportNumber || ""}
                  onChange={(event) => setFormData({ ...formData, passportNumber: event.target.value })}
                />
                <Input
                  placeholder="Emergency contact"
                  value={formData.emergencyContactName || ""}
                  onChange={(event) =>
                    setFormData({ ...formData, emergencyContactName: event.target.value })
                  }
                />
                <Input
                  placeholder="Emergency phone"
                  value={formData.emergencyContactPhone || ""}
                  onChange={(event) =>
                    setFormData({ ...formData, emergencyContactPhone: event.target.value })
                  }
                />
              </div>
              <textarea
                className="flex min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Address"
                value={formData.address || ""}
                onChange={(event) => setFormData({ ...formData, address: event.target.value })}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Submitting..." : "Submit Check-in"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
