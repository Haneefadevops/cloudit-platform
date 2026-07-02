"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, getPublicProfileUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MetricsCards } from "@/components/analytics/metrics-cards";
import { CRMSummaryCards } from "@/components/crm/summary-cards";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ErrorState,
  EmptyState,
} from "@/components/empty-states";
import { DashboardSkeleton } from "@/components/loading/dashboard-skeleton";
import type { Profile, ProfileMetrics, NetworkSummary, CRMSummary } from "@/lib/contracts";
import {
  ArrowRight,
  UserCircle,
  QrCode,
  Search,
  Calendar,
  Sparkles,
} from "lucide-react";

export default function DashboardPage() {
  const auth = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [metrics, setMetrics] = useState<ProfileMetrics | null>(null);
  const [networkSummary, setNetworkSummary] = useState<NetworkSummary | null>(
    null
  );
  const [crmSummary, setCrmSummary] = useState<CRMSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [profileResult, metricsResult, networkResult, crmResult] =
        await Promise.all([
          apiFetch<Profile>("/profiles/me"),
          apiFetch<ProfileMetrics>("/analytics/me"),
          apiFetch<NetworkSummary>("/network/summary"),
          apiFetch<CRMSummary>("/crm/summary"),
        ]);

      if (!profileResult.ok) {
        setStatus("error");
        setError(profileResult.error);
        return;
      }

      setProfile(profileResult.data);
      setMetrics(
        metricsResult.ok
          ? metricsResult.data
          : {
              profileViews: 0,
              qrScans: 0,
              vcardDownloads: 0,
              connectionsAdded: 0,
            }
      );
      setNetworkSummary(
        networkResult.ok
          ? networkResult.data
          : {
              savedByMe: 0,
              savedMe: 0,
              mutualConnections: 0,
              discoverableProfiles: 0,
            }
      );
      setCrmSummary(
        crmResult.ok
          ? crmResult.data
          : {
              lifecycle: {
                new: 0,
                contacted: 0,
                meeting: 0,
                proposal: 0,
                won: 0,
                lost: 0,
              },
              highPriority: 0,
              openFollowUps: 0,
              overdueFollowUps: 0,
            }
      );
      setStatus("success");
    }

    if (auth.status === "authenticated") {
      load();
    }
  }, [auth.status]);

  if (status === "loading") {
    return <DashboardSkeleton />;
  }

  if (status === "error" || !profile) {
    return (
      <ErrorState
        title="Could not load dashboard"
        message={error || "Unable to load your profile."}
        action={
          <Button onClick={() => window.location.reload()}>Try again</Button>
        }
      />
    );
  }

  const publicUrl = getPublicProfileUrl(profile.slug);
  const firstName = auth.user?.fullName.split(" ")[0];

  return (
    <div className="space-y-8">
      {/* Welcome + CTAs */}
      <section className="relative overflow-hidden rounded-3xl bg-primary p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-accent/20 blur-2xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-accent-2" />
              Made for Sri Lankan professionals
            </div>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-2 text-white/80">
              Here is what is happening with your OrbitOne profile this week.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
            <Link href="/dashboard/profile">
              <Button
                variant="outline"
                className="w-full border-white/30 text-white hover:bg-white hover:text-primary sm:w-auto"
              >
                Edit profile
              </Button>
            </Link>
            <Link href={publicUrl} target="_blank">
              <Button className="w-full bg-white text-primary hover:bg-white/90 sm:w-auto">
                View public profile
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics bento */}
      {metrics ? (
        <MetricsCards metrics={metrics} />
      ) : (
        <EmptyState
          title="No analytics yet"
          message="Share your profile to start seeing views, scans, and connections."
        />
      )}

      {/* Network + CRM bento */}
      <div className="grid gap-6 lg:grid-cols-3">
        {networkSummary && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Network</CardTitle>
              <CardDescription>
                How your profile is connected across OrbitOne.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <NetworkStat
                  label="Saved by me"
                  value={networkSummary.savedByMe}
                  href="/dashboard/connections"
                />
                <NetworkStat
                  label="Saved me"
                  value={networkSummary.savedMe}
                  href="/dashboard/connections?tab=inbound"
                />
                <NetworkStat
                  label="Mutual"
                  value={networkSummary.mutualConnections}
                  href="/dashboard/connections?tab=mutual"
                />
                <NetworkStat
                  label="Discoverable"
                  value={networkSummary.discoverableProfiles}
                  href="/dashboard/discover"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {crmSummary && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>CRM snapshot</CardTitle>
              <CardDescription>
                Stay on top of your connections and follow-ups.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CRMSummaryCards summary={crmSummary} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            icon={<UserCircle className="h-5 w-5 text-white" />}
            title="Complete profile"
            description="Add headline, photo, and links."
            href="/dashboard/profile"
            gradient="from-secondary to-accent-2"
          />
          <QuickActionCard
            icon={<QrCode className="h-5 w-5 text-white" />}
            title="Share QR code"
            description="Display or download your code."
            href={`/u/${profile.slug}`}
            gradient="from-accent-2 to-accent"
          />
          <QuickActionCard
            icon={<Search className="h-5 w-5 text-white" />}
            title="Discover"
            description="Find other professionals."
            href="/dashboard/discover"
            gradient="from-accent to-accent-2"
          />
          <QuickActionCard
            icon={<Calendar className="h-5 w-5 text-white" />}
            title="Scheduling"
            description="Manage bookings and availability."
            href="/dashboard/scheduling"
            gradient="from-secondary to-accent"
          />
        </div>
      </section>
    </div>
  );
}

function NetworkStat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary hover:shadow-card"
    >
      <span className="text-sm text-muted">{label}</span>
      <span className="flex items-center gap-2 text-xl font-bold text-foreground">
        {value.toLocaleString()}
        <ArrowRight className="h-4 w-4 text-muted opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
      </span>
    </Link>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  href,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-dropdown"
    >
      <div
        className={[
          "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm",
          gradient,
        ].join(" ")}
      >
        {icon}
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-secondary">
        Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
