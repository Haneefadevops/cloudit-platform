import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/);

export const meetingTypeInputSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/).optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(480),
  locationType: z.enum(["video", "phone", "in_person", "custom"]).optional(),
  locationValue: z.string().trim().max(500).nullable().optional(),
  bufferBeforeMinutes: z.number().int().min(0).max(240).optional(),
  bufferAfterMinutes: z.number().int().min(0).max(240).optional(),
  minNoticeMinutes: z.number().int().min(0).max(43200).optional(),
  bookingWindowDays: z.number().int().min(1).max(365).optional(),
  maxBookingsPerDay: z.number().int().min(1).nullable().optional(),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional()
});

export type MeetingTypeInput = z.infer<typeof meetingTypeInputSchema>;

export const availabilityRuleInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeSchema,
  endTime: timeSchema,
  timezone: z.string().trim().min(1).max(80),
  isActive: z.boolean().optional()
}).refine((value) => value.endTime > value.startTime, {
  message: "Availability end time must be after start time."
});

export const availabilityExceptionInputSchema = z.object({
  exceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: timeSchema.nullable().optional(),
  endTime: timeSchema.nullable().optional(),
  timezone: z.string().trim().min(1).max(80),
  isAvailable: z.boolean().optional(),
  reason: z.string().trim().max(240).nullable().optional()
}).refine((value) => {
  if (!value.startTime || !value.endTime) return true;
  return value.endTime > value.startTime;
}, {
  message: "Availability exception end time must be after start time."
});

export const availabilityInputSchema = z.object({
  rules: z.array(availabilityRuleInputSchema).max(42),
  exceptions: z.array(availabilityExceptionInputSchema).max(365).default([])
});

export type AvailabilityRuleInput = z.infer<typeof availabilityRuleInputSchema>;
export type AvailabilityExceptionInput = z.infer<typeof availabilityExceptionInputSchema>;
