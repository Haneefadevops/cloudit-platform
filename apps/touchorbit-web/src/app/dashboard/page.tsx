"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  useToast,
} from "@cloudit/ui";
import { Users, Calendar, Clock, Banknote, Activity } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Summary {
  activeEmployees: number;
  newHires30d: number;
  pendingLeave: number;
  pendingOvertime: number;
  pendingExpenses: number;
  scheduledToday: number;
  clockedInToday: number;
  attendanceRateToday: number;
}

interface Activity {
  id: string;
  title: string;
  action: string;
  module: string;
  actor_name: string;
  created_at: string;
  severity: string;
}

const statCards = (summary: Summary | null) => [
  {
    label: "Active Employees",
    value: summary?.activeEmployees ?? 0,
    icon: Users,
  },
  {
    label: "Attendance Today",
    value: `${summary?.attendanceRateToday ?? 0}%`,
    sub: `${summary?.clockedInToday ?? 0} / ${summary?.scheduledToday ?? 0} clocked in`,
    icon: Clock,
  },
  {
    label: "Pending Leave",
    value: summary?.pendingLeave ?? 0,
    icon: Calendar,
  },
  {
    label: "Pending Expenses",
    value: summary?.pendingExpenses ?? 0,
    icon: Banknote,
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const [summaryData, activitiesData] = await Promise.all([
          apiFetch<Summary>("/api/dashboard/summary"),
          apiFetch<Activity[]>("/api/dashboard/activities"),
        ]);
        setSummary(summaryData);
        setActivities(activitiesData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not load dashboard";
        addToast({ title: "Dashboard error", description: message, variant: "error" });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [addToast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.fullName || user?.email}. Here is what is happening in your organization.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards(summary).map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    {stat.sub && (
                      <p className="text-xs text-muted-foreground">{stat.sub}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest actions across your HR modules.</CardDescription>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity.</p>
                ) : (
                  <ul className="space-y-3">
                    {activities.slice(0, 10).map((activity) => (
                      <li key={activity.id} className="flex items-start justify-between text-sm">
                        <div>
                          <p className="font-medium">{activity.title}</p>
                          <p className="text-muted-foreground">
                            {activity.actor_name || "System"} • {activity.module}
                          </p>
                        </div>
                        <Badge variant={activity.severity === "high" ? "destructive" : "secondary"}>
                          {activity.action}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
                <CardDescription>Common HR actions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Employee management, leave approvals, and payroll modules will be linked here as they are built out.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
