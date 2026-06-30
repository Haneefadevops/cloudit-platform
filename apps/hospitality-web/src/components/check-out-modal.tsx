"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Input, Form, FormField, FormLabel } from "@cloudit/ui";
import { formatDate, formatLkr } from "@/lib/format";
import type { Reservation } from "@/lib/types";

interface CheckOutModalProps {
  open: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  onConfirm: (id: string, finalAmount?: number, notes?: string) => void;
}

export function CheckOutModal({ open, onClose, reservation, onConfirm }: CheckOutModalProps) {
  const [finalAmount, setFinalAmount] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (reservation) {
      setFinalAmount(String(reservation.totalAmount ?? ""));
    } else {
      setFinalAmount("");
      setNotes("");
    }
  }, [reservation, open]);

  if (!reservation) return null;

  const guestName = `${reservation.guest?.firstName || ""} ${reservation.guest?.lastName || ""}`.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Check-out Guest"
      description={`${guestName} — Room ${reservation.room?.roomNumber} — ${formatDate(
        reservation.checkInDate,
      )} to ${formatDate(reservation.checkOutDate)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              onConfirm(reservation.id, finalAmount ? Number(finalAmount) : undefined, notes);
              setNotes("");
            }}
          >
            Confirm Check-out
          </Button>
        </>
      }
    >
      <Form className="space-y-4">
        <FormField>
          <FormLabel>Final Amount (Rs.)</FormLabel>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={finalAmount}
            onChange={(e) => setFinalAmount(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use the reservation total of {formatLkr(reservation.totalAmount)}
          </p>
        </FormField>
        <FormField>
          <FormLabel>Check-out Notes</FormLabel>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about the check-out"
          />
        </FormField>
      </Form>
    </Modal>
  );
}
