import { z } from "zod";

export const organizationInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  name: z.string().trim().min(1).max(120),
  industry: z.string().trim().max(120).nullable().optional(),
  logoUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
});

export const inviteStaffSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["staff", "admin"]).optional(),
  fullName: z.string().trim().max(120).optional(),
});

export const createStaffProfileSchema = z.object({
  userId: z.string().uuid().optional(),
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  department: z.string().trim().max(120).nullable().optional(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/, "Invalid slug")
    .max(60)
    .optional(),
});

export type OrganizationInput = z.infer<typeof organizationInputSchema>;
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;
export type CreateStaffProfileInput = z.infer<typeof createStaffProfileSchema>;
