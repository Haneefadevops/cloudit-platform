"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@cloudit/ui";
import { StatsCard } from "@/components/stats-card";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { formatDate, formatLkr } from "@/lib/format";
import type { Reservation, Room } from "@/lib/types";
import { Calendar, LogIn, LogOut, Receipt, BedDouble, Users, ClipboardList } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    checkIns: 0,
    checkOuts: 0,
    occupancyRate: 0,
    revenue: 0,
  });
  const [roomStatus, setRoomStatus] = useState({
    available: 0,
    occupied: 0,
    maintenance: 0,
    cleaning: 0,
  });
  const [recentReservations, setRecentReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const today = new Date().toISOString().split("T")[0];

  async function loadDashboard() {
    try {
      setIsLoading(true);
      const [roomsRes, reservationsRes] = await Promise.all([
        api.get<{ data: Room[] }>("/rooms?limit=1000"),
        api.get<{ data: Reservation[] }>("/reservations?limit=10"),
      ]);

      const rooms = roomsRes.data;
      const reservations = reservationsRes.data;

      const statusCounts = rooms.reduce(
        (acc, room) => {
          acc[room.status] = (acc[room.status] || 0) + 1;
          return acc;
        },
        { available: 0, occupied: 0, maintenance: 0, cleaning: 0 }
      );

      const totalRooms = rooms.length;
      const occupiedRooms = statusCounts.occupied;
      const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

      const todayCheckIns = reservations.filter((r) =>
        r.checkInDate.startsWith(today)
      ).length;
      const todayCheckOuts = reservations.filter((r) =>
        r.checkOutDate.startsWith(today)
      ).length;
      const todayRevenue = reservations
        .filter((r) => r.checkInDate.startsWith(today) && r.status !== "cancelled")
        .reduce((sum, r) => sum + r.totalAmount, 0);

      setRoomStatus(statusCounts);
      setStats({
        checkIns: todayCheckIns,
        checkOuts: todayCheckOuts,
        occupancyRate: Number(occupancyRate.toFixed(1)),
        revenue: todayRevenue,
      });
      setRecentReservations(reservations.slice(0, 10));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "secondary",
      confirmed: "default",
      checked_in: "default",
      checked_out: "secondary",
      cancelled: "destructive",
      no_show: "outline",
    };
    return <Badge variant={variants[status] as any}>{status.replace("_", " ")}</Badge>;
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your hospitality operations">
        <Button onClick={() => router.push("/dashboard/reservations/new")}>
          <ClipboardList className="mr-2 h-4 w-4" />
          New Reservation
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Today's Check-ins"
          value={stats.checkIns}
          description={today}
          icon={<LogIn className="h-4 w-4" />}
        />
        <StatsCard
          title="Today's Check-outs"
          value={stats.checkOuts}
          description={today}
          icon={<LogOut className="h-4 w-4" />}
        />
        <StatsCard
          title="Occupancy Rate"
          value={`${stats.occupancyRate}%`}
          description={`${roomStatus.occupied} occupied rooms`}
          icon={<BedDouble className="h-4 w-4" />}
        />
        <StatsCard
          title="Today's Revenue"
          value={formatLkr(stats.revenue)}
          description="From today's arrivals"
          icon={<Receipt className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BedDouble className="h-4 w-4" />
              Room Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(roomStatus).map(([status, count]) => (
                <div key={status} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground capitalize">{status}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push("/dashboard/checkin")}>
              <LogIn className="mr-2 h-4 w-4" />
              Check-in Guest
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push("/dashboard/checkout")}>
              <LogOut className="mr-2 h-4 w-4" />
              Check-out Guest
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push("/dashboard/invoices")}>
              <Receipt className="mr-2 h-4 w-4" />
              Generate Invoice
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-4 w-4" />
            Recent Reservations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentReservations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No recent reservations
                    </TableCell>
                  </TableRow>
                ) : (
                  recentReservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell className="font-medium">{reservation.reservationNumber}</TableCell>
                      <TableCell>
                        {reservation.guest?.firstName} {reservation.guest?.lastName}
                      </TableCell>
                      <TableCell>{reservation.room?.roomNumber}</TableCell>
                      <TableCell>{formatDate(reservation.checkInDate)}</TableCell>
                      <TableCell>{formatDate(reservation.checkOutDate)}</TableCell>
                      <TableCell>{getStatusBadge(reservation.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
