"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Select,
} from "@cloudit/ui";
import { Plus, Pencil, Trash2, ClipboardList, LogIn, LogOut } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ReservationModal } from "@/components/reservation-modal";
import { CheckInModal } from "@/components/check-in-modal";
import { CheckOutModal } from "@/components/check-out-modal";
import { api } from "@/lib/api";
import type {
  Property,
  Room,
  RoomType,
  Guest,
  Reservation,
  PaginatedResponse,
} from "@/lib/types";

const statusBadgeVariant: Record<string, string> = {
  pending: "secondary",
  confirmed: "default",
  checked_in: "default",
  checked_out: "secondary",
  cancelled: "destructive",
  no_show: "outline",
};

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [checkInReservation, setCheckInReservation] = useState<Reservation | null>(null);
  const [checkOutReservation, setCheckOutReservation] = useState<Reservation | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      const [rRes, pRes, roomRes, rtRes, gRes] = await Promise.all([
        api.get<PaginatedResponse<Reservation>>("/reservations?limit=1000"),
        api.get<PaginatedResponse<Property>>("/properties?limit=100"),
        api.get<PaginatedResponse<Room>>("/rooms?limit=1000"),
        api.get<PaginatedResponse<RoomType>>("/room-types?limit=100"),
        api.get<PaginatedResponse<Guest>>("/guests?limit=1000"),
      ]);
      setReservations(rRes.data);
      setProperties(pRes.data);
      setRooms(roomRes.data);
      setRoomTypes(rtRes.data);
      setGuests(gRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredReservations = reservations.filter((res) => {
    const guestName = `${res.guest?.firstName || ""} ${res.guest?.lastName || ""}`.toLowerCase();
    const matchesSearch =
      res.reservationNumber.toLowerCase().includes(search.toLowerCase()) ||
      guestName.includes(search.toLowerCase()) ||
      res.room?.roomNumber.toLowerCase().includes(search.toLowerCase());
    const matchesProperty = propertyFilter ? res.propertyId === propertyFilter : true;
    const matchesStatus = statusFilter ? res.status === statusFilter : true;
    return matchesSearch && matchesProperty && matchesStatus;
  });

  const handleSubmit = async (data: Partial<Reservation>) => {
    try {
      if (editingReservation) {
        await api.patch(`/reservations/${editingReservation.id}`, data);
      } else {
        await api.post("/reservations", data);
      }
      setModalOpen(false);
      setEditingReservation(null);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (reservation: Reservation) => {
    if (!confirm(`Delete reservation ${reservation.reservationNumber}?`)) return;
    try {
      await api.delete(`/reservations/${reservation.id}`);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleCheckIn = async (id: string, notes?: string) => {
    try {
      await api.post(`/reservations/${id}/check-in`, { notes });
      setCheckInReservation(null);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleCheckOut = async (id: string, finalAmount?: number, notes?: string) => {
    try {
      await api.post(`/reservations/${id}/check-out`, { finalAmount, notes });
      setCheckOutReservation(null);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "checked_in", label: "Checked In" },
    { value: "checked_out", label: "Checked Out" },
    { value: "cancelled", label: "Cancelled" },
    { value: "no_show", label: "No Show" },
  ];

  const propertyOptions = [
    { value: "", label: "All Properties" },
    ...properties.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reservations" description="Manage bookings and reservations">
        <Button onClick={() => { setEditingReservation(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          New Reservation
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Input
              placeholder="Search reservations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select
              options={propertyOptions}
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="max-w-xs"
            />
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredReservations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No reservations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-muted-foreground" />
                          {reservation.reservationNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        {reservation.guest?.firstName} {reservation.guest?.lastName}
                      </TableCell>
                      <TableCell>{reservation.room?.roomNumber}</TableCell>
                      <TableCell>{reservation.property?.name}</TableCell>
                      <TableCell>{new Date(reservation.checkInDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(reservation.checkOutDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[reservation.status] as any}>
                          {reservation.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {reservation.status === "confirmed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCheckInReservation(reservation)}
                            >
                              <LogIn className="mr-1 h-3 w-3" />
                              Check In
                            </Button>
                          )}
                          {reservation.status === "checked_in" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCheckOutReservation(reservation)}
                            >
                              <LogOut className="mr-1 h-3 w-3" />
                              Check Out
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingReservation(reservation); setModalOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(reservation)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ReservationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingReservation(null); }}
        reservation={editingReservation}
        properties={properties}
        rooms={rooms}
        roomTypes={roomTypes}
        guests={guests}
        onSubmit={handleSubmit}
        onGuestsChange={loadData}
      />

      <CheckInModal
        open={!!checkInReservation}
        onClose={() => setCheckInReservation(null)}
        reservation={checkInReservation}
        onConfirm={handleCheckIn}
      />

      <CheckOutModal
        open={!!checkOutReservation}
        onClose={() => setCheckOutReservation(null)}
        reservation={checkOutReservation}
        onConfirm={handleCheckOut}
      />
    </div>
  );
}
