"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardContent, Select, buttonVariants } from "@cloudit/ui";
import { CheckCircle2, CreditCard, DoorOpen } from "lucide-react";
import { formatDate, formatLkr } from "@/lib/format";
import type { PaymentIntent, PaymentMethod, PublicBookingPortal } from "@/lib/types";

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

const paymentOptions = [
  { value: "payhere", label: "PayHere" },
  { value: "stripe", label: "Stripe" },
];

export default function GuestCheckoutPage({ params }: { params: { token: string } }) {
  const [portal, setPortal] = useState<PublicBookingPortal | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("payhere");
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPortal();
  }, [params.token]);

  const balance = useMemo(
    () => Math.max(portal?.reservation.balance ?? 0, 0),
    [portal?.reservation.balance],
  );

  async function loadPortal() {
    try {
      setIsLoading(true);
      setError("");
      const data = await publicApi<PublicBookingPortal>(`/public/bookings/${params.token}`);
      setPortal(data);
      setIsComplete(data.reservation.status === "checked_out");
    } catch (loadError: any) {
      setError(loadError?.message || "Unable to load checkout");
    } finally {
      setIsLoading(false);
    }
  }

  async function createIntent() {
    if (balance <= 0) return;
    try {
      setIsCreatingIntent(true);
      setError("");
      const data = await publicApi<PaymentIntent>("/public/payments/intent", {
        method: "POST",
        body: JSON.stringify({
          token: params.token,
          amount: balance,
          method: paymentMethod,
        }),
      });
      setIntent(data);
      await loadPortal();
    } catch (intentError: any) {
      setError(intentError?.message || "Unable to create payment intent");
    } finally {
      setIsCreatingIntent(false);
    }
  }

  async function completeCheckout() {
    if (balance > 0 && !intent) {
      setError("Create a payment intent before completing check-out");
      return;
    }

    try {
      setIsCheckingOut(true);
      setError("");
      const data = await publicApi<PublicBookingPortal>(
        `/public/bookings/${params.token}/checkout`,
        {
          method: "POST",
          body: JSON.stringify({
            paymentMethod: intent?.provider ?? paymentMethod,
            providerRef: intent?.providerRef,
          }),
        },
      );
      setPortal(data);
      setIsComplete(true);
    } catch (checkoutError: any) {
      setError(checkoutError?.message || "Unable to complete check-out");
    } finally {
      setIsCheckingOut(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Loading check-out...</p>
      </main>
    );
  }

  if (error && !portal) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!portal) return null;

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-muted-foreground">{portal.property.name}</p>
            <h1 className="text-2xl font-semibold">Self Check-out</h1>
            <p className="text-sm text-muted-foreground">
              Reservation {portal.reservation.reservationNumber}
            </p>
          </div>
          <Badge variant={isComplete ? "secondary" : "default"}>
            {isComplete ? "checked out" : portal.reservation.status.replace("_", " ")}
          </Badge>
        </header>

        {isComplete && (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>Your check-out is complete.</span>
              </div>
              <Link className={buttonVariants({ variant: "outline" })} href={`/guest/${params.token}`}>
                Back to Portal
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <section className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <DoorOpen className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Room {portal.room.roomNumber}, {portal.room.roomType}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Check-in</p>
                    <p className="font-medium">{formatDate(portal.reservation.checkInDate)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Check-out</p>
                    <p className="font-medium">{formatDate(portal.reservation.checkOutDate)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4 text-sm">
                <h2 className="font-semibold">Final bill</h2>
                {portal.invoice && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice</span>
                    <span>{portal.invoice.invoiceNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span>{formatLkr(portal.reservation.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span>{formatLkr(portal.reservation.paidAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-3 text-base font-medium">
                  <span>Balance due</span>
                  <span>{formatLkr(balance)}</span>
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold">Payment</h2>
                </div>
                {balance > 0 ? (
                  <>
                    <Select
                      options={paymentOptions}
                      value={paymentMethod}
                      onChange={(event) => {
                        setPaymentMethod(event.target.value as PaymentMethod);
                        setIntent(null);
                      }}
                    />
                    <Button
                      onClick={createIntent}
                      disabled={isCreatingIntent || isComplete}
                      variant="outline"
                      className="w-full"
                    >
                      {isCreatingIntent ? "Creating..." : "Create Payment Intent"}
                    </Button>
                    {intent && (
                      <div className="space-y-2 rounded-md border p-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Provider</span>
                          <span>{intent.provider}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount</span>
                          <span>{formatLkr(intent.amount)}</span>
                        </div>
                        <div className="break-all text-xs text-muted-foreground">
                          {intent.providerRef}
                        </div>
                        {intent.checkoutUrl && (
                          <a
                            className={buttonVariants({ className: "w-full" })}
                            href={intent.checkoutUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Payment
                          </a>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No payment is due.</p>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  onClick={completeCheckout}
                  disabled={isCheckingOut || isComplete || (balance > 0 && !intent)}
                  className="w-full"
                >
                  {isCheckingOut ? "Completing..." : "Complete Check-out"}
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
