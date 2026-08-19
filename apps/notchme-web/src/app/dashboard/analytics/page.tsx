"use client";

import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Eye,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActionableInsights,
  useAnalyticsMe,
  type ActionableInsights,
} from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";

export default function InsightsPage() {
  const { state } = useAuth();
  const basic = useAnalyticsMe();
  const plan = state.status === "authenticated" ? state.user.plan : "free";
  const paid = plan !== "free";
  const insights = useActionableInsights(paid);

  if (state.status === "loading" || basic.isLoading) {
    return <InsightsSkeleton />;
  }

  const metrics = basic.data?.profileMetrics;
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-sm font-medium text-primary">
          Relationship insights
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Understand what is moving forward
        </h1>
        <p className="mt-1 max-w-2xl text-muted">
          Factual signals from your page, people, meetings, and next actions.
        </p>
      </header>

      <section aria-labelledby="page-activity-title">
        <h2 id="page-activity-title" className="text-sm font-medium text-muted">
          Page activity · all time
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Profile views"
            value={metrics?.profileViews ?? 0}
            icon={Eye}
          />
          <Metric
            label="vCard downloads"
            value={metrics?.vcardDownloads ?? 0}
            icon={UserPlus}
          />
          <Metric
            label="Bookings created"
            value={metrics?.bookingsCreated ?? 0}
            icon={Calendar}
          />
        </div>
      </section>

      {!paid ? (
        <Card className="border-primary/20 bg-surface">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">
                See what needs attention next
              </p>
              <p className="mt-1 text-sm text-muted">
                Founding Pro adds 30-day relationship activity, overdue work,
                meeting-recap gaps, and booking momentum.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/upgrade">View Founding Pro</Link>
            </Button>
          </CardContent>
        </Card>
      ) : insights.isLoading ? (
        <InsightsSkeleton compact />
      ) : insights.isError || !insights.data ? (
        <Card>
          <CardContent className="p-6">
            <p role="alert" className="text-sm text-error">
              Insights could not be loaded.
            </p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => insights.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PaidInsights data={insights.data} />
      )}
    </div>
  );
}

function PaidInsights({ data }: { data: ActionableInsights }) {
  return (
    <>
      <section aria-labelledby="attention-title">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2
              id="attention-title"
              className="text-lg font-semibold text-foreground"
            >
              What deserves attention
            </h2>
            <p className="text-sm text-muted">
              Based only on saved workflow data.
            </p>
          </div>
        </div>
        {data.actions.length ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {data.actions.map((action) => (
              <Card key={action.kind}>
                <CardContent className="flex h-full items-start justify-between gap-4 p-5">
                  <div>
                    <p className="font-semibold text-foreground">
                      {action.title}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {action.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    aria-label={action.title}
                  >
                    <Link href={action.href}>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-3">
            <CardContent className="flex items-center gap-3 p-5">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="font-medium text-foreground">
                  No urgent gaps found
                </p>
                <p className="text-sm text-muted">
                  Your saved setup and immediate workflow are clear.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="workflow-title">
        <h2
          id="workflow-title"
          className="text-lg font-semibold text-foreground"
        >
          Current workflow
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Overdue actions"
            value={data.workflow.overdueFollowUps}
          />
          <Metric
            label="Due in 7 days"
            value={data.workflow.dueNextSevenDays}
          />
          <Metric
            label="Upcoming meetings"
            value={data.workflow.upcomingBookings}
          />
          <Metric
            label="Recaps to review"
            value={data.workflow.recapsToReview}
          />
        </div>
      </section>

      <section aria-labelledby="activity-title">
        <h2
          id="activity-title"
          className="text-lg font-semibold text-foreground"
        >
          Last {data.periodDays} days
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Page views"
            value={data.activity.profileViews}
            change={change(
              data.activity.profileViews,
              data.activity.profileViewsPrevious,
            )}
          />
          <Metric
            label="People added"
            value={data.activity.newPeople}
            change={change(
              data.activity.newPeople,
              data.activity.newPeoplePrevious,
            )}
          />
          <Metric
            label="Bookings"
            value={data.activity.bookings}
            change={change(
              data.activity.bookings,
              data.activity.bookingsPrevious,
            )}
          />
          <Metric
            label="Actions completed"
            value={data.activity.completedFollowUps}
          />
        </div>
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  change: comparison,
}: {
  label: string;
  value: number;
  icon?: React.ElementType;
  change?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 text-sm text-muted">
          <span>{label}</span>
          {Icon && <Icon className="h-4 w-4" />}
        </div>
        <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
        {comparison && <p className="mt-1 text-xs text-muted">{comparison}</p>}
      </CardContent>
    </Card>
  );
}

function change(current: number, previous: number): string {
  if (previous === 0)
    return current === 0
      ? "No change from prior 30 days"
      : "New activity this period";
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return "No change from prior 30 days";
  return `${Math.abs(percent)}% ${percent > 0 ? "more" : "fewer"} than prior 30 days`;
}

function InsightsSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-4 p-4 sm:p-6" aria-busy="true">
      {!compact && (
        <>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-28" />
        ))}
      </div>
    </div>
  );
}
