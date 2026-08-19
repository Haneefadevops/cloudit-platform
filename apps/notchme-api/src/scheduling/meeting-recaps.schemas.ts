import { z } from "zod";

const stripTags = (value: string) => value.replace(/<[^>]*>/g, "");
const listItemSchema = z.string().trim().max(300).transform(stripTags);

export const recapDraftSchema = z
  .object({
    summary: z.string().trim().max(2000).transform(stripTags),
    keyPoints: z.array(listItemSchema).max(20).default([]),
    commitments: z.array(listItemSchema).max(20).default([]),
    privateNote: z
      .string()
      .trim()
      .max(2000)
      .transform(stripTags)
      .optional()
      .nullable(),
    proposedFollowUpTitle: z
      .string()
      .trim()
      .max(160)
      .transform(stripTags)
      .optional()
      .nullable(),
    proposedFollowUpDueAt: z.string().datetime().optional().nullable(),
  })
  .strict();

export type RecapDraftInput = z.infer<typeof recapDraftSchema>;

export const recapFinalizeSchema = z
  .object({
    createFollowUp: z.boolean().default(false),
    followUpTitle: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .transform(stripTags)
      .optional(),
    followUpDueAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.createFollowUp) return;
    if (!value.followUpTitle) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["followUpTitle"],
        message: "A follow-up title is required.",
      });
    }
    if (!value.followUpDueAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["followUpDueAt"],
        message: "A follow-up due date is required.",
      });
    }
  });

export type RecapFinalizeInput = z.infer<typeof recapFinalizeSchema>;
