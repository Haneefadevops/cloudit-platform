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
