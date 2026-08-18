import { z } from "zod";

export const profileInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/)
    .optional(),
  fullName: z.string().trim().min(1).max(120).optional(),
  headline: z.string().trim().max(160).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  avatarUrl: z.string().trim().url().nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  websiteUrl: z.string().trim().url().nullable().optional(),
  linkedinUrl: z.string().trim().url().nullable().optional(),
  xUrl: z.string().trim().url().nullable().optional(),
  department: z.string().trim().max(120).nullable().optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  isPublished: z.boolean().optional(),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

const normalizedPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .refine((value) => /^\+?[1-9]\d{6,19}$/.test(value), "Invalid phone number");

export const publicContactCaptureSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase())
      .optional()
      .or(z.literal("")),
    phone: normalizedPhoneSchema.optional().or(z.literal("")),
    company: z.string().trim().max(120).optional().or(z.literal("")),
    message: z.string().trim().max(1000).optional().or(z.literal("")),
    acknowledgement: z.literal(true),
    website: z.string().trim().max(200).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.email && !value.phone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email or phone is required",
      });
    }
  });

export type PublicContactCaptureInput = z.infer<
  typeof publicContactCaptureSchema
>;
