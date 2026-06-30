import { z } from "zod";

export const templateInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["activity", "follow_up", "email", "note"]),
  subject: z.string().trim().max(200).nullable().optional().or(z.literal("")),
  body: z.string().trim().min(1).max(5000)
});

export type TemplateInput = z.infer<typeof templateInputSchema>;
