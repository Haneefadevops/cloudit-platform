"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  useMeetingTypes,
  useCreateMeetingType,
  useUpdateMeetingType,
  useDeleteMeetingType,
} from "@/hooks/useScheduling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Video, Phone, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MeetingType, MeetingTypeInput } from "@/lib/contracts";

const meetingTypeFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9-]*$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .max(60)
    .optional(),
  description: z.string().max(600).optional(),
  durationMinutes: z.string(),
  locationType: z.enum(["video", "phone", "in_person", "custom"]),
  locationValue: z.string().max(500).optional(),
  bufferBeforeMinutes: z.string(),
  bufferAfterMinutes: z.string(),
  minNoticeMinutes: z.string(),
  bookingWindowDays: z.string(),
  maxBookingsPerDay: z.string().optional(),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

type MeetingTypeFormValues = z.infer<typeof meetingTypeFormSchema>;

const defaultValues: MeetingTypeFormValues = {
  title: "",
  slug: "",
  description: "",
  durationMinutes: "30",
  locationType: "video",
  locationValue: "",
  bufferBeforeMinutes: "0",
  bufferAfterMinutes: "0",
  minNoticeMinutes: "60",
  bookingWindowDays: "30",
  maxBookingsPerDay: "",
  requiresApproval: false,
  isActive: true,
};

function valuesToInput(values: MeetingTypeFormValues): MeetingTypeInput {
  return {
    title: values.title,
    slug: values.slug || undefined,
    description: values.description || null,
    durationMinutes: Number(values.durationMinutes),
    locationType: values.locationType,
    locationValue: values.locationValue || null,
    bufferBeforeMinutes: Number(values.bufferBeforeMinutes),
    bufferAfterMinutes: Number(values.bufferAfterMinutes),
    minNoticeMinutes: Number(values.minNoticeMinutes),
    bookingWindowDays: Number(values.bookingWindowDays),
    maxBookingsPerDay: values.maxBookingsPerDay ? Number(values.maxBookingsPerDay) : null,
    requiresApproval: values.requiresApproval,
    isActive: values.isActive,
  };
}

function meetingTypeToFormValues(meetingType: MeetingType): MeetingTypeFormValues {
  return {
    title: meetingType.title,
    slug: meetingType.slug,
    description: meetingType.description ?? "",
    durationMinutes: String(meetingType.durationMinutes),
    locationType: meetingType.locationType,
    locationValue: meetingType.locationValue ?? "",
    bufferBeforeMinutes: String(meetingType.bufferBeforeMinutes),
    bufferAfterMinutes: String(meetingType.bufferAfterMinutes),
    minNoticeMinutes: String(meetingType.minNoticeMinutes),
    bookingWindowDays: String(meetingType.bookingWindowDays),
    maxBookingsPerDay: meetingType.maxBookingsPerDay ? String(meetingType.maxBookingsPerDay) : "",
    requiresApproval: meetingType.requiresApproval,
    isActive: meetingType.isActive,
  };
}

export default function MeetingTypesPage() {
  const { data: meetingTypes, isLoading } = useMeetingTypes();
  const [editing, setEditing] = useState<MeetingType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary">Meeting types</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add meeting type
          </Button>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit meeting type" : "New meeting type"}</DialogTitle>
            </DialogHeader>
            <MeetingTypeForm initial={editing} onClose={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {meetingTypes?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted">No meeting types yet.</p>
            <Button className="mt-4" size="sm" onClick={() => setIsDialogOpen(true)}>
              Create your first meeting type
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {meetingTypes?.map((mt) => (
            <MeetingTypeCard
              key={mt.id}
              meetingType={mt}
              onEdit={() => {
                setEditing(mt);
                setIsDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingTypeCard({
  meetingType,
  onEdit,
}: {
  meetingType: MeetingType;
  onEdit: () => void;
}) {
  const update = useUpdateMeetingType();
  const remove = useDeleteMeetingType();
  const LocationIcon =
    meetingType.locationType === "video"
      ? Video
      : meetingType.locationType === "phone"
      ? Phone
      : meetingType.locationType === "in_person"
      ? MapPin
      : User;

  return (
    <Card className={cn("transition-opacity", !meetingType.isActive && "opacity-60")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{meetingType.title}</CardTitle>
            <p className="text-xs text-muted">/{meetingType.slug}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove.mutate(meetingType.id)}
              isLoading={remove.isPending}
            >
              <Trash2 className="h-4 w-4 text-error" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{meetingType.durationMinutes} min</Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <LocationIcon className="h-3 w-3" />
            {meetingType.locationType.replace("_", " ")}
          </Badge>
          {meetingType.requiresApproval && <Badge variant="warning">Approval required</Badge>}
          {!meetingType.isActive && <Badge variant="error">Inactive</Badge>}
        </div>
        {meetingType.description && (
          <p className="text-sm text-muted">{meetingType.description}</p>
        )}
        <div className="flex items-center gap-2">
          <Switch
            checked={meetingType.isActive}
            onChange={(e) =>
              update.mutate({ id: meetingType.id, input: { isActive: e.target.checked } })
            }
          />
          <span className="text-sm text-muted">Active</span>
        </div>
      </CardContent>
    </Card>
  );
}

function MeetingTypeForm({
  initial,
  onClose,
}: {
  initial: MeetingType | null;
  onClose: () => void;
}) {
  const create = useCreateMeetingType();
  const update = useUpdateMeetingType();
  const [validationError, setValidationError] = useState<string | null>(null);

  const form = useForm<MeetingTypeFormValues>({
    defaultValues: initial ? meetingTypeToFormValues(initial) : defaultValues,
  });

  async function onSubmit(values: MeetingTypeFormValues) {
    const parsed = meetingTypeFormSchema.safeParse(values);
    if (!parsed.success) {
      setValidationError("Please check the form for errors.");
      return;
    }

    const input = valuesToInput(parsed.data);

    if (initial) {
      await update.mutateAsync({ id: initial.id, input });
    } else {
      await create.mutateAsync(input);
    }
    setValidationError(null);
    onClose();
  }

  const error = create.error || update.error || validationError;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...form.register("title")} />
        {form.formState.errors.title && (
          <p className="text-sm text-error">{form.formState.errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug (optional)</Label>
        <Input id="slug" {...form.register("slug")} placeholder="auto-generated" />
        {form.formState.errors.slug && (
          <p className="text-sm text-error">{form.formState.errors.slug.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...form.register("description")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="durationMinutes">Duration (minutes)</Label>
          <Input id="durationMinutes" type="number" min={5} {...form.register("durationMinutes")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="locationType">Location type</Label>
          <select
            id="locationType"
            {...form.register("locationType")}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="video">Video</option>
            <option value="phone">Phone</option>
            <option value="in_person">In person</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="locationValue">Location details (URL, address, phone)</Label>
        <Input id="locationValue" {...form.register("locationValue")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bufferBeforeMinutes">Buffer before (min)</Label>
          <Input id="bufferBeforeMinutes" type="number" min={0} {...form.register("bufferBeforeMinutes")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bufferAfterMinutes">Buffer after (min)</Label>
          <Input id="bufferAfterMinutes" type="number" min={0} {...form.register("bufferAfterMinutes")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="minNoticeMinutes">Minimum notice (min)</Label>
          <Input id="minNoticeMinutes" type="number" min={0} {...form.register("minNoticeMinutes")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bookingWindowDays">Booking window (days)</Label>
          <Input id="bookingWindowDays" type="number" min={1} {...form.register("bookingWindowDays")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxBookingsPerDay">Max bookings per day (optional)</Label>
        <Input id="maxBookingsPerDay" type="number" min={1} {...form.register("maxBookingsPerDay")} />
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <Switch id="requiresApproval" {...form.register("requiresApproval")} />
        <div>
          <Label htmlFor="requiresApproval" className="cursor-pointer">
            Require approval
          </Label>
          <p className="text-xs text-muted">Bookings will be pending until you approve them.</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-error">
          {typeof error === "string" ? error : error.message}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={create.isPending || update.isPending}>
          {initial ? "Save changes" : "Create meeting type"}
        </Button>
      </div>
    </form>
  );
}
