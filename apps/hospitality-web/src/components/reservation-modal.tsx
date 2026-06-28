"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Button,
  Input,
  Select,
  Form,
  FormField,
  FormLabel,
  FormError,
} from "@cloudit/ui";
import { UserPlus } from "lucide-react";
import { GuestModal } from "./guest-modal";
import { api } from "@/lib/api";
import type { Property, Room, RoomType, Guest, Reservation, PaginatedResponse } from "@/lib/types";

interface ReservationModalProps {
  open: boolean;
  onClose: () => void;
  reservation?: Reservation | null;
  properties: Property[];
  rooms: Room[];
  roomTypes: RoomType[];
  guests: Guest[];
  onSubmit: (data: Partial<Reservation>) => void;
  onGuestsChange?: () => void;
}

const statuses = ["pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"];
const sources = ["direct", "walk_in", "phone", "email"];

function toDateInputValue(iso?: string) {
  if (!iso) return "";
  return iso.split("T")[0];
}

export function ReservationModal({
  open,
  onClose,
  reservation,
  properties,
  rooms,
  roomTypes,
  guests,
  onSubmit,
  onGuestsChange,
}: ReservationModalProps) {
  const [formData, setFormData] = useState<Partial<Reservation>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [localGuests, setLocalGuests] = useState<Guest[]>(guests);

  useEffect(() => {
    setLocalGuests(guests);
  }, [guests]);

  useEffect(() => {
    if (reservation) {
      setFormData({
        ...reservation,
        checkInDate: toDateInputValue(reservation.checkInDate),
        checkOutDate: toDateInputValue(reservation.checkOutDate),
      });
    } else {
      setFormData({
        status: "pending",
        source: "direct",
        adults: 1,
        children: 0,
        totalAmount: 0,
        paidAmount: 0,
      });
    }
    setErrors({});
  }, [reservation, open]);

  const propertyOptions = useMemo(
    () => properties.map((p) => ({ value: p.id, label: p.name })),
    [properties]
  );

  const roomOptions = useMemo(() => {
    if (!formData.propertyId) return [];
    return rooms
      .filter((r) => r.propertyId === formData.propertyId)
      .map((r) => {
        const rt = roomTypes.find((t) => t.id === r.roomTypeId);
        return { value: r.id, label: `${r.roomNumber}${rt ? ` — ${rt.name}` : ""}` };
      });
  }, [rooms, roomTypes, formData.propertyId]);

  const guestOptions = useMemo(
    () =>
      localGuests.map((g) => ({
        value: g.id,
        label: `${g.firstName} ${g.lastName}${g.phone ? ` (${g.phone})` : ""}`,
      })),
    [localGuests]
  );

  const statusOptions = statuses.map((s) => ({ value: s, label: s.replace("_", " ") }));
  const sourceOptions = sources.map((s) => ({ value: s, label: s.replace("_", " ") }));

  const handlePropertyChange = (propertyId: string) => {
    const roomStillValid = rooms.some(
      (r) => r.id === formData.roomId && r.propertyId === propertyId
    );
    setFormData((prev) => ({
      ...prev,
      propertyId,
      roomId: roomStillValid ? prev.roomId : "",
    }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.propertyId) newErrors.propertyId = "Property is required";
    if (!formData.roomId) newErrors.roomId = "Room is required";
    if (!formData.guestId) newErrors.guestId = "Guest is required";
    if (!formData.checkInDate) newErrors.checkInDate = "Check-in date is required";
    if (!formData.checkOutDate) newErrors.checkOutDate = "Check-out date is required";
    if (formData.checkInDate && formData.checkOutDate) {
      const checkIn = new Date(formData.checkInDate);
      const checkOut = new Date(formData.checkOutDate);
      if (checkOut <= checkIn) {
        newErrors.checkOutDate = "Check-out must be after check-in";
      }
    }
    if ((formData.adults ?? 1) < 1) newErrors.adults = "At least 1 adult is required";
    if ((formData.totalAmount ?? 0) < 0) newErrors.totalAmount = "Total amount cannot be negative";
    if ((formData.paidAmount ?? 0) < 0) newErrors.paidAmount = "Paid amount cannot be negative";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit({
        ...formData,
        adults: Number(formData.adults),
        children: Number(formData.children ?? 0),
        totalAmount: Number(formData.totalAmount ?? 0),
        paidAmount: Number(formData.paidAmount ?? 0),
      });
    }
  };

  const handleGuestCreated = async (data: Partial<Guest>) => {
    try {
      const created = await api.post<Guest>("/guests", data);
      setGuestModalOpen(false);
      const refreshed = await api.get<PaginatedResponse<Guest>>("/guests?limit=1000");
      setLocalGuests(refreshed.data);
      setFormData((prev) => ({ ...prev, guestId: created.id }));
      onGuestsChange?.();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={reservation ? "Edit Reservation" : "New Reservation"}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit}>{reservation ? "Update" : "Create"}</Button>
          </>
        }
      >
        <Form className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField>
              <FormLabel required>Property</FormLabel>
              <Select
                placeholder="Select property"
                options={propertyOptions}
                value={formData.propertyId || ""}
                onChange={(e) => handlePropertyChange(e.target.value)}
              />
              <FormError message={errors.propertyId} />
            </FormField>
            <FormField>
              <FormLabel required>Room</FormLabel>
              <Select
                placeholder={formData.propertyId ? "Select room" : "Select a property first"}
                options={roomOptions}
                value={formData.roomId || ""}
                onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                disabled={!formData.propertyId}
              />
              <FormError message={errors.roomId} />
            </FormField>
          </div>

          <FormField>
            <div className="flex items-center justify-between">
              <FormLabel required>Guest</FormLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGuestModalOpen(true)}
              >
                <UserPlus className="mr-1 h-4 w-4" />
                New Guest
              </Button>
            </div>
            <Select
              placeholder="Select guest"
              options={guestOptions}
              value={formData.guestId || ""}
              onChange={(e) => setFormData({ ...formData, guestId: e.target.value })}
            />
            <FormError message={errors.guestId} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField>
              <FormLabel required>Check-in Date</FormLabel>
              <Input
                type="date"
                value={formData.checkInDate || ""}
                onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                error={errors.checkInDate}
              />
            </FormField>
            <FormField>
              <FormLabel required>Check-out Date</FormLabel>
              <Input
                type="date"
                value={formData.checkOutDate || ""}
                onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                error={errors.checkOutDate}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <FormField>
              <FormLabel required>Adults</FormLabel>
              <Input
                type="number"
                min={1}
                value={formData.adults ?? 1}
                onChange={(e) => setFormData({ ...formData, adults: Number(e.target.value) })}
                error={errors.adults}
              />
            </FormField>
            <FormField>
              <FormLabel>Children</FormLabel>
              <Input
                type="number"
                min={0}
                value={formData.children ?? 0}
                onChange={(e) => setFormData({ ...formData, children: Number(e.target.value) })}
              />
            </FormField>
            <FormField>
              <FormLabel required>Status</FormLabel>
              <Select
                options={statusOptions}
                value={formData.status || "pending"}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Reservation["status"] })}
              />
            </FormField>
            <FormField>
              <FormLabel required>Source</FormLabel>
              <Select
                options={sourceOptions}
                value={formData.source || "direct"}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField>
              <FormLabel required>Total Amount (Rs.)</FormLabel>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={formData.totalAmount ?? 0}
                onChange={(e) => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                error={errors.totalAmount}
              />
            </FormField>
            <FormField>
              <FormLabel required>Paid Amount (Rs.)</FormLabel>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={formData.paidAmount ?? 0}
                onChange={(e) => setFormData({ ...formData, paidAmount: Number(e.target.value) })}
                error={errors.paidAmount}
              />
            </FormField>
          </div>

          <FormField>
            <FormLabel>Notes</FormLabel>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </FormField>
        </Form>
      </Modal>

      <GuestModal
        open={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        onSubmit={handleGuestCreated}
      />
    </>
  );
}
