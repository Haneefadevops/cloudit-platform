import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GreetingHeader } from "@/components/dashboard/greeting-header";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useProfile";
import { useDashboardSummary } from "@/hooks/useDashboard";
import {
  ExternalLink,
  User,
  QrCode,
  Calendar,
  TrendingUp,
  Users,
  Zap,
  Copy,
  ArrowRight,
  Kanban,
  Share2,
} from "lucide-react";
import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";

export function DashboardHomePage() {
  const { state } = useAuth();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();

  const user = state.status === "authenticated" ? state.user : null;
  const publicUrl = profile ? `${window.location.origin}/p/${profile.slug}` : "";
  const isLoading = profileLoading || summaryLoading;
  const plan = user?.plan ?? "free";
  const isPro = plan === "pro_individual" || plan.startsWith("pro_business");
  const hasCRM = user?.organizationId !== null || plan.startsWith("pro_business");

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!profile) {
    return (
      <div className="p-6 md:p-8">
        <Card className="text-center">
          <CardHeader>
            <CardTitle>Welcome to OrbitOne</CardTitle>
            <CardDescription>Create your profile to start sharing and booking.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/dashboard/profile">Create profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const crmEmpty =
    hasCRM &&
    summary?.crmSummary &&
    summary.crmSummary.totalCustomers === 0;

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <GreetingHeader name={user?.fullName} />

      {/* Primary stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Profile views"
          value={summary?.profileMetrics.profileViews ?? 0}
          icon={<TrendingUp className="h-5 w-5" />}
          size="large"
        />
        <StatCard
          label="Bookings"
          value={summary?.profileMetrics.bookingsCreated ?? 0}
          icon={<Calendar className="h-5 w-5" />}
          size="large"
        />
        <StatCard
          label="QR scans"
          value={summary?.profileMetrics.qrScans ?? 0}
          icon={<QrCode className="h-5 w-5" />}
          size="small"
        />
        <UsageCard
          used={summary?.usage.bookingsThisWeek ?? 0}
          limit={isPro ? undefined : (summary?.usage.bookingsWeekLimit ?? 3)}
          isPro={isPro}
        />
      </div>

      {/* Main grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Profile + QR share block */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 md:flex-row">
              {/* Profile info */}
              <div className="flex flex-1 items-start gap-4">
                <Avatar src={profile.avatarUrl} fallback={profile.fullName} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-semibold text-foreground">{profile.fullName}</h2>
                    <Badge variant={profile.isPublished ? "success" : "warning"}>
                      {profile.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">{profile.headline ?? "Your public profile"}</p>
                  <p className="mt-1 text-sm font-medium text-secondary">/{profile.slug}</p>

                  {profile.isPublished && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface p-2">
                      <span className="min-w-0 flex-1 truncate text-xs text-muted">{publicUrl}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 px-0 shrink-0"
                        onClick={() => navigator.clipboard.writeText(publicUrl)}
                        aria-label="Copy profile link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button size="sm" asChild>
                      <Link to="/dashboard/profile">Edit profile</Link>
                    </Button>
                    {profile.isPublished && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={publicUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" />
                          View public page
                        </a>
                      </Button>
                    )}
                    {profile.isPublished && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/dashboard/settings">
                          <Share2 className="mr-2 h-4 w-4" />
                          Share QR
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* QR code */}
              {profile.isPublished && (
                <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl border border-border bg-surface-elevated p-5">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    <QrCode className="h-3.5 w-3.5" />
                    Scan to connect
                  </h3>
                  <div className="rounded-xl bg-white p-3">
                    <QRCode value={publicUrl} size={128} />
                  </div>
                  <p className="mt-3 text-center text-xs text-muted">Scan to view your public profile</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analytics mini-card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
              <TrendingUp className="h-4 w-4" />
              Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-3xl font-semibold tracking-tight text-foreground">
                  {summary?.profileMetrics.profileViews ?? 0}
                </p>
                <p className="text-xs text-muted">Views</p>
              </div>
              <div>
                <p className="text-3xl font-semibold tracking-tight text-foreground">
                  {summary?.profileMetrics.bookingsCreated ?? 0}
                </p>
                <p className="text-xs text-muted">Bookings</p>
              </div>
            </div>
            <Button variant="outline" className="mt-6 w-full" size="sm" asChild>
              <Link to="/dashboard/analytics">View analytics</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming bookings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
              <Calendar className="h-4 w-4" />
              Upcoming bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary && summary.upcomingBookings.length > 0 ? (
              <ul className="space-y-3">
                {summary.upcomingBookings.slice(0, 4).map((booking) => (
                  <li
                    key={booking.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{booking.guest?.name}</p>
                        <p className="text-xs text-muted">{booking.meetingType?.title}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted">
                      {new Date(booking.startAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        timeZone: booking.timezone,
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center">
                <p className="text-muted">No upcoming bookings.</p>
                <Button size="sm" variant="outline" className="mt-3" asChild>
                  <Link to="/dashboard/scheduling">Set up meetings</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CRM snapshot */}
        {hasCRM && summary?.crmSummary && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
                  <Users className="h-4 w-4" />
                  CRM snapshot
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" asChild>
                  <Link to="/dashboard/customers/pipeline">
                    <Kanban className="h-3.5 w-3.5" />
                    Pipeline
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {crmEmpty ? (
                <div className="text-center">
                  <p className="text-muted">No customers yet.</p>
                  <p className="mt-1 text-xs text-muted">Add your first contact to start tracking deals.</p>
                  <Button size="sm" className="mt-4 w-full" asChild>
                    <Link to="/dashboard/customers">Add your first customer</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricBox value={summary.crmSummary.totalCustomers} label="Customers" />
                    <MetricBox value={summary.crmSummary.openFollowUps} label="Follow-ups" />
                    <MetricBox
                      value={formatCurrency(summary.crmSummary.forecastValue, summary.crmSummary.forecastCurrency)}
                      label="Forecast"
                    />
                    <MetricBox
                      value={`${summary.crmSummary.wonCount}:${summary.crmSummary.lostCount}`}
                      label="Won : Lost"
                    />
                  </div>
                  <div className="mt-4 grid gap-3">
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link to="/dashboard/customers">View customers</Link>
                    </Button>
                    <Button size="sm" className="w-full" asChild>
                      <Link to="/dashboard/customers/pipeline">
                        Open pipeline
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  size = "small",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  size?: "small" | "large";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
          <div className="text-secondary">{icon}</div>
        </div>
        <div className="mt-4">
          <div className={cn("font-semibold tracking-tight text-foreground", size === "large" ? "text-4xl" : "text-3xl")}>
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageCard({ used, limit, isPro }: { used: number; limit?: number; isPro: boolean }) {
  const total = isPro ? Math.max(used, 1) : (limit ?? 3);
  const percentage = isPro ? 0 : Math.min((used / total) * 100, 100);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">This week</span>
          <Zap className="h-5 w-5 text-secondary" />
        </div>
        <div className="mt-4">
          <div className="text-3xl font-semibold tracking-tight text-foreground">
            {used}
            {!isPro && <span className="text-lg text-muted"> / {total}</span>}
          </div>
          <p className="mt-1 text-xs text-muted">{isPro ? "Unlimited bookings on Pro" : "Free plan weekly limit"}</p>
          {!isPro && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-secondary transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBox({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function formatCurrency(value: number, currency: string) {
  if (value === 0) return "0";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(value);
}

function DashboardSkeleton() {
  return (
    <div className="p-6 md:p-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-2 h-5 w-48" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}


