"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@cloudit/ui";
import { LogOut, Calendar } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CheckOutModal } from "@/components/check-out-modal";
import { api } from "@/lib/api";
import type { Reservation, PaginatedResponse } from "@/lib/types";

export default function CheckOutPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadCheckOuts();
  }, []);

  async function loadCheckOuts() {
    try {
      setIsLoading(true);
      const res = await api.get<PaginatedResponse<Reservation>>(
        `/reservations?status=checked_in&limit=1000`
      );
      const todaysCheckOuts = res.data.filter((r) => r.checkOutDate.startsWith(today));
      setReservations(todaysCheckOuts);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleCheckOut = async (id: string, finalAmount?: number, notes?: string) => {
    try {
      await api.post(`/reservations/${id}/check-out`, { finalAmount, notes });
      setSelectedReservation(null);
      loadCheckOuts();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Check-out" description={`Expected check-outs for ${today}`} />

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
                  <TableHead>Check-in</TableHead>
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
                      No expected check-outs for today
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
                      <TableCell>{new Date(reservation.checkInDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="default">{reservation.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => setSelectedReservation(reservation)}>
                          <LogOut className="mr-1 h-4 w-4" />
                          Check Out
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

      <CheckOutModal
        open={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        reservation={selectedReservation}
        onConfirm={handleCheckOut}
      />
    </div>
  );
}
