"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Input, Select, Form, FormField, FormLabel, FormError } from "@cloudit/ui";
import type { HousekeepingTask, HousekeepingTaskType, Room } from "@/lib/types";

interface HousekeepingTaskModalProps {
  open: boolean;
  onClose: () => void;
  rooms: Room[];
  task?: HousekeepingTask | null;
  onSubmit: (data: Partial<HousekeepingTask>) => void;
}

const typeOptions = [
  { value: "checkout_clean", label: "Checkout Clean" },
  { value: "stayover_clean", label: "Stayover Clean" },
  { value: "deep_clean", label: "Deep Clean" },
  { value: "maintenance_followup", label: "Maintenance Follow-up" },
];

function toDateInputValue(iso?: string) {
  if (!iso) return "";
  return iso.split("T")[0];
}

export function HousekeepingTaskModal({
  open,
  onClose,
  rooms,
  task,
  onSubmit,
}: HousekeepingTaskModalProps) {
  const [formData, setFormData] = useState<Partial<HousekeepingTask>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData(
      task
        ? { ...task, dueDate: toDateInputValue(task.dueDate) }
        : { type: "checkout_clean", status: "pending", priority: 3 },
    );
    setErrors({});
  }, [task, open]);

  const roomOptions = useMemo(
    () =>
      rooms.map((room) => ({
        value: room.id,
        label: `${room.roomNumber} - ${room.roomType?.name || "Room"}`,
      })),
    [rooms],
  );

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!formData.roomId) nextErrors.roomId = "Room is required";
    if (!formData.type) nextErrors.type = "Task type is required";
    if (!formData.priority || formData.priority < 1 || formData.priority > 5) {
      nextErrors.priority = "Priority must be from 1 to 5";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit({
      roomId: formData.roomId,
      type: formData.type as HousekeepingTaskType,
      priority: Number(formData.priority ?? 3),
      assignedTo: formData.assignedTo,
      dueDate: formData.dueDate || undefined,
      notes: formData.notes,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? "Edit Housekeeping Task" : "New Housekeeping Task"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{task ? "Update" : "Create"}</Button>
        </>
      }
    >
      <Form className="space-y-4">
        <FormField>
          <FormLabel required>Room</FormLabel>
          <Select
            placeholder="Select room"
            options={roomOptions}
            value={formData.roomId || ""}
            onChange={(event) => setFormData({ ...formData, roomId: event.target.value })}
            disabled={!!task}
          />
          <FormError message={errors.roomId} />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField>
            <FormLabel required>Type</FormLabel>
            <Select
              options={typeOptions}
              value={formData.type || "checkout_clean"}
              onChange={(event) =>
                setFormData({ ...formData, type: event.target.value as HousekeepingTaskType })
              }
            />
            <FormError message={errors.type} />
          </FormField>
          <FormField>
            <FormLabel required>Priority</FormLabel>
            <Input
              type="number"
              min={1}
              max={5}
              value={formData.priority ?? 3}
              onChange={(event) => setFormData({ ...formData, priority: Number(event.target.value) })}
              error={errors.priority}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField>
            <FormLabel>Assigned To</FormLabel>
            <Input
              value={formData.assignedTo || ""}
              onChange={(event) => setFormData({ ...formData, assignedTo: event.target.value })}
            />
          </FormField>
          <FormField>
            <FormLabel>Due Date</FormLabel>
            <Input
              type="date"
              value={formData.dueDate || ""}
              onChange={(event) => setFormData({ ...formData, dueDate: event.target.value })}
            />
          </FormField>
        </div>

        <FormField>
          <FormLabel>Notes</FormLabel>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formData.notes || ""}
            onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
          />
        </FormField>
      </Form>
    </Modal>
  );
}
