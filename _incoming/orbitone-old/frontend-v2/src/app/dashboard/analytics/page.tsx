import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAnalyticsMe } from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { Eye, Download, Calendar, Star, Users, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function AnalyticsPage() {
  const { data, isLoading } = useAnalyticsMe();
  const { state } = useAuth();

  const plan = state.status === "authenticated" ? state.user.plan : "free";
  const analyticsEnabled = plan === "pro_individual" || plan.startsWith("pro_business");

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!analyticsEnabled) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Analytics</h1>
          <p className="text-muted">Track profile views, bookings, and more.</p>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <TrendingUp className="mx-auto h-12 w-12 text-muted" />
            <h2 className="mt-4 text-lg font-semibold text-primary">Analytics is a Pro feature</h2>
            <p className="mt-2 text-muted">
              Upgrade to Pro Individual to see detailed stats on your profile and bookings.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/dashboard/upgrade">Upgrade now</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const metrics = data?.profileMetrics;
  const usage = data?.usage;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Analytics</h1>
        <p className="text-muted">How your profile is performing.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Profile views"
          value={metrics?.profileViews ?? 0}
          icon={Eye}
        />
        <MetricCard
          label="vCard downloads"
          value={metrics?.vcardDownloads ?? 0}
          icon={Download}
        />
        <MetricCard
          label="Bookings created"
          value={metrics?.bookingsCreated ?? 0}
          icon={Calendar}
        />
        <MetricCard
          label="Connections added"
          value={metrics?.connectionsAdded ?? 0}
          icon={Users}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Booking usage this week
            </CardTitle>
            <CardDescription>
              {usage?.bookingsWeekLimit === null
                ? "Unlimited bookings on your Pro plan."
                : `Free plan includes ${usage?.bookingsWeekLimit} bookings per week.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-primary">{usage?.bookingsThisWeek ?? 0}</span>
              {usage?.bookingsWeekLimit !== null && (
                <span className="text-muted">/ {usage?.bookingsWeekLimit}</span>
              )}
            </div>
            {usage?.bookingsWeekLimit !== null && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-secondary"
                  style={{
                    width: `${Math.min(
                      100,
                      ((usage?.bookingsThisWeek ?? 0) / (usage?.bookingsWeekLimit ?? 1)) * 100
                    )}%`,
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Ratings
            </CardTitle>
            <CardDescription>Average customer rating.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-primary">
                {metrics?.ratingsAverage?.toFixed(1) ?? "0.0"}
              </span>
              <span className="text-muted">from {metrics?.ratingsCount ?? 0} reviews</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Icon className="h-5 w-5 text-muted" />
          <Badge variant="outline">{label}</Badge>
        </div>
        <p className="mt-2 text-3xl font-bold text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}
