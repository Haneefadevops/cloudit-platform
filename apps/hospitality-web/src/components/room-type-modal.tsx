"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Input, Form, FormField, FormLabel } from "@cloudit/ui";
import type { RoomType } from "@/lib/types";

interface RoomTypeModalProps {
  open: boolean;
  onClose: () => void;
  roomType?: RoomType | null;
  properties: { id: string; name: string }[];
  onSubmit: (data: Partial<RoomType>) => void;
}

export function RoomTypeModal({ open, onClose, roomType, properties, onSubmit }: RoomTypeModalProps) {
  const [formData, setFormData] = useState<Partial<RoomType>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData(roomType ?? {});
    setErrors({});
  }, [roomType, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = "Name is required";
    if (!formData.propertyId) newErrors.propertyId = "Property is required";
    if (formData.basePrice === undefined || formData.basePrice < 0) {
      newErrors.basePrice = "Base price is required";
    }
    if (!formData.maxOccupancy || formData.maxOccupancy < 1) {
      newErrors.maxOccupancy = "Max occupancy is required";
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
      title={roomType ? "Edit Room Type" : "Add Room Type"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{roomType ? "Update" : "Create"}</Button>
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
          <FormLabel required>Name</FormLabel>
          <Input
            value={formData.name || ""}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
          />
        </FormField>
        <FormField>
          <FormLabel>Description</FormLabel>
          <Input
            value={formData.description || ""}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </FormField>
        <FormField>
          <FormLabel required>Base Price</FormLabel>
          <Input
            type="number"
            value={formData.basePrice ?? ""}
            onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
            error={errors.basePrice}
          />
        </FormField>
        <FormField>
          <FormLabel required>Max Occupancy</FormLabel>
          <Input
            type="number"
            value={formData.maxOccupancy ?? ""}
            onChange={(e) => setFormData({ ...formData, maxOccupancy: Number(e.target.value) })}
            error={errors.maxOccupancy}
          />
        </FormField>
      </Form>
    </Modal>
  );
}
