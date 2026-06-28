"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Input, Form, FormField, FormLabel, FormError } from "@cloudit/ui";
import type { Guest } from "@/lib/types";

interface GuestModalProps {
  open: boolean;
  onClose: () => void;
  guest?: Guest | null;
  onSubmit: (data: Partial<Guest>) => void;
}

export function GuestModal({ open, onClose, guest, onSubmit }: GuestModalProps) {
  const [formData, setFormData] = useState<Partial<Guest>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData(guest ?? {});
    setErrors({});
  }, [guest, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName?.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName?.trim()) newErrors.lastName = "Last name is required";
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Invalid email address";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={guest ? "Edit Guest" : "Add Guest"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{guest ? "Update" : "Create"}</Button>
        </>
      }
    >
      <Form className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField>
            <FormLabel required>First Name</FormLabel>
            <Input
              value={formData.firstName || ""}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              error={errors.firstName}
            />
          </FormField>
          <FormField>
            <FormLabel required>Last Name</FormLabel>
            <Input
              value={formData.lastName || ""}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              error={errors.lastName}
            />
          </FormField>
        </div>
        <FormField>
          <FormLabel>Email</FormLabel>
          <Input
            type="email"
            value={formData.email || ""}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
          />
        </FormField>
        <FormField>
          <FormLabel>Phone</FormLabel>
          <Input
            value={formData.phone || ""}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField>
            <FormLabel>ID Number</FormLabel>
            <Input
              value={formData.idNumber || ""}
              onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
            />
          </FormField>
          <FormField>
            <FormLabel>Nationality</FormLabel>
            <Input
              value={formData.nationality || ""}
              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
            />
          </FormField>
        </div>
        <FormField>
          <FormLabel>Address</FormLabel>
          <Input
            value={formData.address || ""}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
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
