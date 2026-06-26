"use client";

import * as React from "react";
import { Users, Building2, UserCheck, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, handleApiError } from "@/lib/api-client";
import type { DashboardStats } from "@/types";

const statsConfig = [
  { key: "usersCount" as const, label: "Total Users", icon: Users },
  { key: "orgsCount" as const, label: "Organizations", icon: Building2 },
  { key: "activeUsers" as const, label: "Active Users", icon: UserCheck },
  { key: "pendingInvites" as const, label: "Pending Invites", icon: Mail },
];

export default function DashboardPage() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadStats() {
      try {
        const data = await api.get<DashboardStats>("/dashboard/stats");
        setStats(data);
      } catch (error) {
        handleApiError(error);
        // Use mock data if API fails
        setStats({
          usersCount: 42,
          orgsCount: 5,
          activeUsers: 38,
          pendingInvites: 3,
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your platform</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsConfig.map((stat) => {
          const Icon = stat.icon;
          const value = stats?.[stat.key] ?? 0;
          return (
            <Card key={stat.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{value}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Recent activity will appear here when connected to the API.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Quick action shortcuts will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
