"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Input, Form, FormField, FormLabel, FormError } from "@cloudit/ui";
import type { Property } from "@/lib/types";

interface PropertyModalProps {
  open: boolean;
  onClose: () => void;
  property?: Property | null;
  onSubmit: (data: Partial<Property>) => void;
}

export function PropertyModal({ open, onClose, property, onSubmit }: PropertyModalProps) {
  const [formData, setFormData] = useState<Partial<Property>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData(property ?? {});
    setErrors({});
  }, [property, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = "Name is required";
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
      title={property ? "Edit Property" : "Add Property"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{property ? "Update" : "Create"}</Button>
        </>
      }
    >
      <Form className="space-y-4">
        <FormField>
          <FormLabel required>Name</FormLabel>
          <Input
            value={formData.name || ""}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
          />
        </FormField>
        <FormField>
          <FormLabel>Address</FormLabel>
          <Input
            value={formData.address || ""}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </FormField>
        <FormField>
          <FormLabel>Phone</FormLabel>
          <Input
            value={formData.phone || ""}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </FormField>
        <FormField>
          <FormLabel>Email</FormLabel>
          <Input
            type="email"
            value={formData.email || ""}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </FormField>
        <FormField>
          <FormLabel>Tax ID</FormLabel>
          <Input
            value={formData.taxId || ""}
            onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField>
            <FormLabel>Business Registration No.</FormLabel>
            <Input
              value={formData.registrationNumber || ""}
              onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
            />
          </FormField>
          <FormField>
            <FormLabel>SLTDA Number</FormLabel>
            <Input
              value={formData.sltdaNumber || ""}
              onChange={(e) => setFormData({ ...formData, sltdaNumber: e.target.value })}
            />
          </FormField>
        </div>
      </Form>
    </Modal>
  );
}
