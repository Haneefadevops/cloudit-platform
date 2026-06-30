"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUpgradePlan } from "@/hooks/useBilling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/contracts";

function planRank(plan: string) {
  if (plan === "free") return 0;
  if (plan === "pro_individual") return 1;
  if (plan.startsWith("pro_business")) return 2;
  return 0;
}

const plans: {
  key: Plan;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}[] = [
  {
    key: "free",
    name: "Free",
    price: "LKR 0",
    period: "forever",
    description: "Perfect for getting started.",
    features: ["Profile + QR code", "vCard download", "Save contact", "Up to 3 bookings/week"],
    cta: "Get started",
    popular: false,
  },
  {
    key: "pro_individual",
    name: "Pro Individual",
    price: "LKR 1,990",
    period: "/month",
    description: "For freelancers and solopreneurs.",
    features: [
      "Everything in Free",
      "Unlimited bookings",
      "Basic analytics",
      "Custom slug priority",
      "Remove OrbitOne branding",
    ],
    cta: "Upgrade to Pro",
    popular: true,
  },
  {
    key: "pro_business_starter",
    name: "Pro Business",
    price: "LKR 4,990",
    period: "/month",
    description: "For teams that need CRM and customer management.",
    features: [
      "Everything in Pro Individual",
      "Customer CRM + pipeline",
      "Ratings & feedback",
      "Documents & quotations",
      "B2B accounts & directory",
      "Admin analytics",
    ],
    cta: "Upgrade to Business",
    popular: false,
  },
];

export default function UpgradePage() {
  const { state } = useAuth();
  const router = useRouter();
  const upgrade = useUpgradePlan();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const currentPlan = state.status === "authenticated" ? state.user.plan : "free";
  const onHighestPlan = currentPlan.startsWith("pro_business");

  async function handleUpgrade() {
    if (!selectedPlan) return;
    await upgrade.mutateAsync(selectedPlan);
    router.push("/dashboard");
  }

  if (state.status === "loading") {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Upgrade your plan</h1>
        <p className="text-muted">Unlock unlimited bookings, analytics, and CRM.</p>
      </div>

      {onHighestPlan && (
        <Card className="border-success">
          <CardContent className="flex items-center gap-3 p-4">
            <Sparkles className="h-5 w-5 text-success" />
            <p className="text-sm">
              You&apos;re already on a <strong>{currentPlan.replace(/_/g, " ")}</strong> plan. Enjoy the benefits!
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.key || (plan.key === "pro_business_starter" && currentPlan.startsWith("pro_business"));
          const isUpgrade = planRank(plan.key) > planRank(currentPlan);
          const isSelected = selectedPlan === plan.key;

          return (
            <Card
              key={plan.key}
              className={cn(
                "relative transition-colors",
                plan.popular && "border-secondary",
                isSelected && !isCurrent && "bg-secondary/5"
              )}
            >
              {plan.popular && (
                <Badge variant="secondary" className="absolute -top-3 left-4">
                  Most popular
                </Badge>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-primary">{plan.price}</span>
                  <span className="text-sm text-muted">{plan.period}</span>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : (
                  <Button
                    variant={plan.popular ? "primary" : "outline"}
                    className="w-full"
                    onClick={() => setSelectedPlan(plan.key)}
                    isLoading={upgrade.isPending && selectedPlan === plan.key}
                    disabled={!isUpgrade || upgrade.isPending}
                  >
                    {isUpgrade ? plan.cta : "Lower plan"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedPlan && planRank(selectedPlan) > planRank(currentPlan) && (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-primary">Ready to upgrade?</h3>
              <p className="text-sm text-muted">
                This is a development placeholder. No real payment will be charged.
              </p>
            </div>
            <Button
              onClick={handleUpgrade}
              isLoading={upgrade.isPending}
              disabled={upgrade.isPending}
            >
              <Zap className="mr-2 h-4 w-4" />
              Confirm upgrade
            </Button>
          </CardContent>
          {upgrade.isError && (
            <CardContent>
              <p className="text-sm text-error">
                {upgrade.error?.message ?? "Could not upgrade plan."}
              </p>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
