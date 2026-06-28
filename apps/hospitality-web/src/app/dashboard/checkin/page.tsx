"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@cloudit/ui";
import { LogIn, Calendar } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CheckInModal } from "@/components/check-in-modal";
import { api } from "@/lib/api";
import type { Reservation, PaginatedResponse } from "@/lib/types";

export default function CheckInPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadCheckIns();
  }, []);

  async function loadCheckIns() {
    try {
      setIsLoading(true);
      const res = await api.get<PaginatedResponse<Reservation>>(
        `/reservations?status=confirmed&startDate=${today}&endDate=${today}&limit=1000`
      );
      setReservations(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleCheckIn = async (id: string, notes?: string) => {
    try {
      await api.post(`/reservations/${id}/check-in`, { notes });
      setSelectedReservation(null);
      loadCheckIns();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Check-in" description={`Expected check-ins for ${today}`} />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reservation</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : reservations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No expected check-ins for today
                    </TableCell>
                  </TableRow>
                ) : (
                  reservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {reservation.reservationNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        {reservation.guest?.firstName} {reservation.guest?.lastName}
                      </TableCell>
                      <TableCell>{reservation.room?.roomNumber}</TableCell>
                      <TableCell>{reservation.property?.name}</TableCell>
                      <TableCell>{new Date(reservation.checkOutDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="default">{reservation.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => setSelectedReservation(reservation)}>
                          <LogIn className="mr-1 h-4 w-4" />
                          Check In
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CheckInModal
        open={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        reservation={selectedReservation}
        onConfirm={handleCheckIn}
      />
    </div>
  );
}
