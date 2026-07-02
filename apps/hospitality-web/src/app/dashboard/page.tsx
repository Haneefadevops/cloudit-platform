"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@cloudit/ui";
import { StatsCard } from "@/components/stats-card";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { formatDate, formatLkr } from "@/lib/format";
import type { DashboardOverview, Reservation } from "@/lib/types";
import { Calendar, LogIn, LogOut, Receipt, BedDouble, ClipboardList } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    checkIns: 0,
    checkOuts: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    totalRooms: 0,
    occupancyRate: 0,
    revenue: 0,
  });
  const [checkIns, setCheckIns] = useState<Reservation[]>([]);
  const [checkOuts, setCheckOuts] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const today = new Date().toISOString().split("T")[0];

  async function loadDashboard() {
    try {
      setIsLoading(true);
      const overview = await api.get<DashboardOverview>("/reports/dashboard");
      setStats({
        ...overview.summary,
      });
      setCheckIns(overview.checkIns);
      setCheckOuts(overview.checkOuts);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your hospitality operations">
        <Button onClick={() => router.push("/dashboard/reservations")}>
          <ClipboardList className="mr-2 h-4 w-4" />
          New Reservation
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Today's Check-ins"
          value={stats.checkIns}
          description={formatDate(today)}
          icon={<LogIn className="h-4 w-4" />}
        />
        <StatsCard
          title="Today's Check-outs"
          value={stats.checkOuts}
          description={formatDate(today)}
          icon={<LogOut className="h-4 w-4" />}
        />
        <StatsCard
          title="Available Rooms"
          value={stats.availableRooms}
          description={`${stats.totalRooms} total rooms`}
          icon={<BedDouble className="h-4 w-4" />}
        />
        <StatsCard
          title="Occupancy Rate"
          value={`${stats.occupancyRate}%`}
          description={`${stats.occupiedRooms} occupied rooms`}
          icon={<BedDouble className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Today's Revenue"
          value={formatLkr(stats.revenue)}
          description="Invoices issued today"
          icon={<Receipt className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BedDouble className="h-4 w-4" />
              Today&apos;s Check-ins
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkIns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No check-ins today.</p>
            ) : (
              <div className="space-y-2">
                {checkIns.slice(0, 5).map((reservation) => (
                  <div key={reservation.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">
                      {reservation.guest?.firstName} {reservation.guest?.lastName}
                    </p>
                    <p className="text-muted-foreground">
                      Room {reservation.room?.roomNumber} - {reservation.property?.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Today&apos;s Check-outs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkOuts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No check-outs today.</p>
            ) : (
              <div className="space-y-2">
                {checkOuts.slice(0, 5).map((reservation) => (
                  <div key={reservation.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">
                      {reservation.guest?.firstName} {reservation.guest?.lastName}
                    </p>
                    <p className="text-muted-foreground">
                      Room {reservation.room?.roomNumber} - {reservation.property?.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          <Button variant="outline" className="justify-start" onClick={() => router.push("/dashboard/checkin")}>
            <LogIn className="mr-2 h-4 w-4" />
            Check-in Guest
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => router.push("/dashboard/checkout")}>
            <LogOut className="mr-2 h-4 w-4" />
            Check-out Guest
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => router.push("/dashboard/invoices")}>
            <Receipt className="mr-2 h-4 w-4" />
            Generate Invoice
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
