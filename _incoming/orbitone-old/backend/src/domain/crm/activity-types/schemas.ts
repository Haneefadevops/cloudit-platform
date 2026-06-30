import { z } from "zod";

export const activityTypeInputSchema = z.object({
  key: z.string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(1).max(120),
  icon: z.string().trim().max(40).nullable().optional().or(z.literal("")),
  order: z.number().int().min(0).optional()
});

export type ActivityTypeInput = z.infer<typeof activityTypeInputSchema>;
