"use client";

import { useState } from "react";
import { Modal, Button, Form, FormField, FormLabel } from "@cloudit/ui";
import { formatDate } from "@/lib/format";
import type { Reservation } from "@/lib/types";

interface CheckInModalProps {
  open: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  onConfirm: (id: string, notes?: string) => void;
}

export function CheckInModal({ open, onClose, reservation, onConfirm }: CheckInModalProps) {
  const [notes, setNotes] = useState("");

  if (!reservation) return null;

  const guestName = `${reservation.guest?.firstName || ""} ${reservation.guest?.lastName || ""}`.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Check-in Guest"
      description={`${guestName} — Room ${reservation.room?.roomNumber} — ${formatDate(
        reservation.checkInDate,
      )} to ${formatDate(reservation.checkOutDate)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onConfirm(reservation.id, notes); setNotes(""); }}>
            Confirm Check-in
          </Button>
        </>
      }
    >
      <Form className="space-y-4">
        <FormField>
          <FormLabel>Check-in Notes</FormLabel>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about the check-in"
          />
        </FormField>
      </Form>
    </Modal>
  );
}
