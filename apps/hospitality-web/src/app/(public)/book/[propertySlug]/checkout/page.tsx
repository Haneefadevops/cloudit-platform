"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Input, Select, buttonVariants } from "@cloudit/ui";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { formatLkr } from "@/lib/format";
import type {
  PaymentMethod,
  PublicAvailabilityResult,
  PublicBookingConfirmation,
} from "@/lib/types";

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

const paymentOptions = [
  { value: "cash", label: "Pay at Property" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "payhere", label: "PayHere" },
  { value: "stripe", label: "Stripe" },
];

export default function PublicCheckoutPage({
  params,
}: {
  params: { propertySlug: string };
}) {
  const searchParams = useSearchParams();
  const roomTypeId = searchParams.get("roomTypeId") || "";
  const checkInDate = searchParams.get("checkInDate") || "";
  const checkOutDate = searchParams.get("checkOutDate") || "";

  const [availability, setAvailability] = useState<PublicAvailabilityResult | null>(null);
  const [confirmation, setConfirmation] = useState<PublicBookingConfirmation | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nicNumber: "",
    passportNumber: "",
    adults: 1,
    children: 0,
    paymentMethod: "cash" as PaymentMethod,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAvailability();
  }, [params.propertySlug, roomTypeId, checkInDate, checkOutDate]);

  async function loadAvailability() {
    try {
      setIsLoading(true);
      setError("");
      const data = await publicApi<PublicAvailabilityResult>("/public/availability", {
        propertySlug: params.propertySlug,
        checkInDate,
        checkOutDate,
      });
      setAvailability(data);
    } catch (loadError: any) {
      setError(loadError?.message || "Unable to load checkout");
    } finally {
      setIsLoading(false);
    }
  }

  const selectedRoomType = useMemo(
    () => availability?.roomTypes.find((roomType) => roomType.id === roomTypeId),
    [availability, roomTypeId],
  );

  async function handleSubmit() {
    if (!selectedRoomType) {
      setError("Selected room type is no longer available");
      return;
    }
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("First name and last name are required");
      return;
    }
    if (!formData.email.trim() && !formData.phone.trim()) {
      setError("Email or phone is required");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      const data = await publicApi<PublicBookingConfirmation>("/public/bookings", {
        propertySlug: params.propertySlug,
        roomTypeId,
        checkInDate,
        checkOutDate,
        ...formData,
      });
      setConfirmation(data);
    } catch (submitError: any) {
      setError(submitError?.message || "Unable to create booking");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Loading checkout...</p>
      </main>
    );
  }

  if (confirmation) {
    const portalUrl = `${window.location.origin}${confirmation.guestPortalUrl}`;
    return (
      <main className="min-h-screen bg-background p-4 sm:p-8">
        <Card className="mx-auto max-w-xl">
          <CardContent className="space-y-4 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
            <div>
              <h1 className="text-2xl font-semibold">Booking confirmed</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Reservation {confirmation.reservation.reservationNumber} is confirmed.
              </p>
            </div>
            <div className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">
                  {formatLkr(confirmation.reservation.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment</span>
                <span>{confirmation.paymentMethod.replace("_", " ")}</span>
              </div>
            </div>
            <Link className={buttonVariants({ className: "w-full" })} href={portalUrl}>
              Open Guest Portal
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{availability?.property.name}</p>
            <h1 className="text-2xl font-semibold">Complete your booking</h1>
          </div>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  placeholder="First name"
                  value={formData.firstName}
                  onChange={(event) =>
                    setFormData({ ...formData, firstName: event.target.value })
                  }
                />
                <Input
                  placeholder="Last name"
                  value={formData.lastName}
                  onChange={(event) =>
                    setFormData({ ...formData, lastName: event.target.value })
                  }
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                />
                <Input
                  placeholder="Phone"
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                />
                <Input
                  placeholder="NIC number"
                  value={formData.nicNumber}
                  onChange={(event) =>
                    setFormData({ ...formData, nicNumber: event.target.value })
                  }
                />
                <Input
                  placeholder="Passport number"
                  value={formData.passportNumber}
                  onChange={(event) =>
                    setFormData({ ...formData, passportNumber: event.target.value })
                  }
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Adults"
                  value={formData.adults}
                  onChange={(event) =>
                    setFormData({ ...formData, adults: Number(event.target.value) })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Children"
                  value={formData.children}
                  onChange={(event) =>
                    setFormData({ ...formData, children: Number(event.target.value) })
                  }
                />
              </div>
              <Select
                options={paymentOptions}
                value={formData.paymentMethod}
                onChange={(event) =>
                  setFormData({ ...formData, paymentMethod: event.target.value as PaymentMethod })
                }
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Confirming..." : "Confirm Booking"}
              </Button>
            </CardContent>
          </Card>
        </section>

        <aside>
          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="text-sm text-muted-foreground">Room</p>
                <h2 className="text-lg font-semibold">{selectedRoomType?.name || "Selected room"}</h2>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {checkInDate} to {checkOutDate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">From</span>
                  <span className="font-medium">
                    {selectedRoomType ? formatLkr(selectedRoomType.basePrice) : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available</span>
                  <span>{selectedRoomType?.availableRooms ?? 0}</span>
                </div>
              </div>
              <Link
                className={buttonVariants({ variant: "outline", className: "w-full" })}
                href={`/book/${params.propertySlug}`}
              >
                Change dates
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
