"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Input, Form, FormField, FormLabel } from "@cloudit/ui";
import type { Room, RoomStatus } from "@/lib/types";

interface RoomModalProps {
  open: boolean;
  onClose: () => void;
  room?: Room | null;
  properties: { id: string; name: string }[];
  roomTypes: { id: string; name: string }[];
  onSubmit: (data: Partial<Room>) => void;
}

const statuses: RoomStatus[] = ["available", "occupied", "maintenance", "cleaning"];

export function RoomModal({ open, onClose, room, properties, roomTypes, onSubmit }: RoomModalProps) {
  const [formData, setFormData] = useState<Partial<Room>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData(room ?? {});
    setErrors({});
  }, [room, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.roomNumber?.trim()) newErrors.roomNumber = "Room number is required";
    if (!formData.propertyId) newErrors.propertyId = "Property is required";
    if (!formData.roomTypeId) newErrors.roomTypeId = "Room type is required";
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
      title={room ? "Edit Room" : "Add Room"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{room ? "Update" : "Create"}</Button>
        </>
      }
    >
      <Form className="space-y-4">
        <FormField>
          <FormLabel required>Property</FormLabel>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={formData.propertyId || ""}
            onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
          >
            <option value="">Select property</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {errors.propertyId && <p className="text-xs text-destructive">{errors.propertyId}</p>}
        </FormField>
        <FormField>
          <FormLabel required>Room Type</FormLabel>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={formData.roomTypeId || ""}
            onChange={(e) => setFormData({ ...formData, roomTypeId: e.target.value })}
          >
            <option value="">Select room type</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </select>
          {errors.roomTypeId && <p className="text-xs text-destructive">{errors.roomTypeId}</p>}
        </FormField>
        <FormField>
          <FormLabel required>Room Number</FormLabel>
          <Input
            value={formData.roomNumber || ""}
            onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
            error={errors.roomNumber}
          />
        </FormField>
        <FormField>
          <FormLabel>Floor</FormLabel>
          <Input
            value={formData.floor || ""}
            onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
          />
        </FormField>
        <FormField>
          <FormLabel>Status</FormLabel>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={formData.status || "available"}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as RoomStatus })}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FormField>
      </Form>
    </Modal>
  );
}
