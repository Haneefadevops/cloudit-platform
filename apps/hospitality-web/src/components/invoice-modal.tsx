"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal, Button, Input, Select, Form, FormField, FormLabel, FormError } from "@cloudit/ui";
import type { Invoice, Reservation } from "@/lib/types";

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoice?: Invoice | null;
  reservations: Reservation[];
  onSubmit: (data: Partial<Invoice>) => void;
}

function toDateInputValue(iso?: string) {
  if (!iso) return "";
  return iso.split("T")[0];
}

export function InvoiceModal({ open, onClose, invoice, reservations, onSubmit }: InvoiceModalProps) {
  const [formData, setFormData] = useState<Partial<Invoice>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (invoice) {
      setFormData({
        ...invoice,
        dueDate: toDateInputValue(invoice.dueDate),
      });
    } else {
      const defaultReservation = reservations[0];
      setFormData({
        reservationId: defaultReservation?.id || "",
        dueDate: "",
        subtotal: defaultReservation?.totalAmount || 0,
        notes: "",
      });
    }
    setErrors({});
  }, [invoice, open, reservations]);

  const reservationOptions = useMemo(
    () =>
      reservations.map((r) => ({
        value: r.id,
        label: `${r.reservationNumber} — ${r.guest?.firstName || ""} ${r.guest?.lastName || ""} (${
          r.room?.roomNumber || "-"
        })`,
      })),
    [reservations]
  );

  const selectedReservation = useMemo(
    () => reservations.find((r) => r.id === formData.reservationId),
    [reservations, formData.reservationId]
  );

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!invoice && !formData.reservationId) {
      newErrors.reservationId = "Reservation is required";
    }
    if ((formData.subtotal ?? 0) < 0) {
      newErrors.subtotal = "Subtotal cannot be negative";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit({
        reservationId: formData.reservationId,
        dueDate: formData.dueDate || undefined,
        subtotal: formData.subtotal !== undefined ? Number(formData.subtotal) : undefined,
        notes: formData.notes,
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={invoice ? "Edit Invoice" : "Create Invoice"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{invoice ? "Update" : "Create"}</Button>
        </>
      }
    >
      <Form className="space-y-4">
        {invoice && (
          <FormField>
            <FormLabel>Invoice Number</FormLabel>
            <Input value={invoice.invoiceNumber} disabled />
          </FormField>
        )}

        {!invoice ? (
          <FormField>
            <FormLabel required>Reservation</FormLabel>
            <Select
              placeholder="Select reservation"
              options={reservationOptions}
              value={formData.reservationId || ""}
              onChange={(e) => {
                const reservationId = e.target.value;
                const reservation = reservations.find((r) => r.id === reservationId);
                setFormData((prev) => ({
                  ...prev,
                  reservationId,
                  subtotal: reservation?.totalAmount ?? prev.subtotal,
                }));
              }}
            />
            <FormError message={errors.reservationId} />
          </FormField>
        ) : (
          <FormField>
            <FormLabel>Reservation</FormLabel>
            <Input
              value={`${invoice.reservation?.reservationNumber || ""} — ${invoice.guest?.firstName || ""} ${invoice.guest?.lastName || ""}`}
              disabled
            />
          </FormField>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField>
            <FormLabel>Issue Date</FormLabel>
            <Input value={invoice ? new Date(invoice.issueDate).toLocaleDateString() : new Date().toLocaleDateString()} disabled />
          </FormField>
          <FormField>
            <FormLabel>Due Date</FormLabel>
            <Input
              type="date"
              value={formData.dueDate || ""}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </FormField>
        </div>

        <FormField>
          <FormLabel>Subtotal (Rs.)</FormLabel>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={formData.subtotal ?? 0}
            onChange={(e) => setFormData({ ...formData, subtotal: Number(e.target.value) })}
            error={errors.subtotal}
          />
          {selectedReservation && !invoice && (
            <p className="text-xs text-muted-foreground">
              Reservation total: Rs. {Number(selectedReservation.totalAmount).toLocaleString()}
            </p>
          )}
        </FormField>

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
  );
}
