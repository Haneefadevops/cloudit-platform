"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBillingStatus,
  useCreateBillingPortal,
  useCreateCheckout,
} from "@/hooks/useBilling";

type Interval = "monthly" | "annual";

export default function PlansPage() {
  const billing = useBillingStatus();
  const checkout = useCreateCheckout();
  const portal = useCreateBillingPortal();
  const { refetch: refetchBilling } = billing;
  const [interval, setInterval] = useState<Interval>("monthly");
  const [returnMessage, setReturnMessage] = useState<string | null>(null);

  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get("checkout");
    if (outcome === "success") {
      setReturnMessage(
        "Checkout completed. Your plan updates after the verified billing event arrives.",
      );
      void refetchBilling();
    } else if (outcome === "cancelled") {
      setReturnMessage(
        "Checkout was cancelled. Your current plan is unchanged.",
      );
    }
  }, [refetchBilling]);

  if (billing.isLoading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const status = billing.data;
  const subscription = status?.subscription;
  const hasCurrentSubscription = Boolean(
    subscription &&
    ["incomplete", "trialing", "active", "past_due", "paused"].includes(
      subscription.status,
    ),
  );
  const error = checkout.error ?? portal.error ?? billing.error;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Plans and billing</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Choose the workspace that fits now
        </h1>
        <p className="mt-1 text-muted">
          Start with a 14-day trial. A payment method is requested only when the
          configured checkout requires one.
        </p>
      </header>

      {returnMessage && (
        <p
          role="status"
          className="rounded-xl border border-border bg-surface p-4 text-sm text-foreground"
        >
          {returnMessage}
        </p>
      )}

      {subscription && (
        <Card className="border-primary/20">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold capitalize text-foreground">
                {subscription.product.replace("_", " ")} ·{" "}
                {subscription.status.replace("_", " ")}
              </p>
              <p className="mt-1 text-sm text-muted">
                {subscription.cancelAtPeriodEnd
                  ? "Cancellation is scheduled for the end of the current period."
                  : subscription.currentPeriodEnd
                    ? `Current period ends ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(subscription.currentPeriodEnd))}.`
                    : "Billing lifecycle is managed by the provider."}
              </p>
            </div>
            {subscription.canManage && (
              <Button
                variant="outline"
                onClick={() => portal.mutate()}
                isLoading={portal.isPending}
              >
                Manage billing <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div
        className="inline-flex min-h-11 rounded-xl border border-border bg-surface p-1"
        aria-label="Billing interval"
      >
        <button
          type="button"
          onClick={() => setInterval("monthly")}
          className={`min-h-9 rounded-lg px-4 text-sm ${interval === "monthly" ? "bg-primary text-primary-foreground" : "text-muted"}`}
          aria-pressed={interval === "monthly"}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval("annual")}
          className={`min-h-9 rounded-lg px-4 text-sm ${interval === "annual" ? "bg-primary text-primary-foreground" : "text-muted"}`}
          aria-pressed={interval === "annual"}
        >
          Annual
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PlanCard
          name="Free"
          price="€0"
          period="forever"
          description="Build and share the essential relationship workflow."
          features={[
            "Professional page, QR and vCard",
            "One meeting type",
            "Up to 50 people",
            "Manual notes and next actions",
            "Basic page statistics",
          ]}
        />
        <PlanCard
          name="Founding Pro"
          price={interval === "annual" ? "€96" : "€10"}
          period={interval === "annual" ? "per year" : "per month"}
          description="For independent professionals who want consistent follow-up."
          features={[
            "Unlimited people and booking options",
            "Today and relationship timeline",
            "Calendar integration",
            "Actionable Insights",
            "Limited private AI recaps",
            "Priority support",
          ]}
          highlighted
          actionLabel={
            subscription ? "Choose Founding Pro" : "Start Founding Pro trial"
          }
          actionEnabled={
            Boolean(status?.products.foundingPro[interval]) &&
            !hasCurrentSubscription
          }
          action={() => checkout.mutate({ product: "founding_pro", interval })}
          loading={checkout.isPending}
        />
        <PlanCard
          name="Teams"
          price={interval === "monthly" ? "€39" : "Contact us"}
          period={
            interval === "monthly" ? "per month · 3 users" : "for annual terms"
          }
          description="For a small team sharing relationships and ownership."
          features={[
            "Everything in Founding Pro",
            "Three included users",
            "Shared people and companies",
            "Ownership and assignment",
            "Company branding",
            "Team insights",
          ]}
          actionLabel={subscription ? "Choose Teams" : "Start Teams trial"}
          actionEnabled={
            interval === "monthly" &&
            Boolean(status?.products.teams.monthly) &&
            !hasCurrentSubscription
          }
          action={() =>
            checkout.mutate({ product: "teams", interval: "monthly" })
          }
          loading={checkout.isPending}
        />
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p>
            {status?.taxNotice ?? "Applicable VAT is calculated at checkout."}
          </p>
          <p className="mt-1">
            Checkout, invoices, payment details, renewal, and cancellation are
            handled in Stripe&apos;s hosted surfaces. NotchMe never stores card
            details.
          </p>
          {!status?.checkoutEnabled && (
            <p className="mt-2 font-medium text-foreground">
              Paid checkout is not configured yet. No plan change will occur.
            </p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error instanceof Error
            ? error.message
            : "Billing could not be opened."}
        </p>
      )}
    </div>
  );
}

function PlanCard({
  name,
  price,
  period,
  description,
  features,
  highlighted = false,
  actionLabel,
  actionEnabled = false,
  action,
  loading = false,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  actionLabel?: string;
  actionEnabled?: boolean;
  action?: () => void;
  loading?: boolean;
}) {
  return (
    <Card className={highlighted ? "border-primary/40" : undefined}>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <p className="text-sm text-muted">{description}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-3xl font-semibold text-foreground">{price}</p>
          <p className="text-sm text-muted">{period}</p>
        </div>
        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              {feature}
            </li>
          ))}
        </ul>
        {actionLabel && (
          <Button
            className="w-full"
            variant={highlighted ? "primary" : "outline"}
            onClick={action}
            disabled={!actionEnabled || loading}
            isLoading={loading}
          >
            {actionEnabled ? actionLabel : "Not available yet"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
