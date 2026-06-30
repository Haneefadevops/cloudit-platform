import { z } from "zod";

export const customFieldInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  key: z.string().trim().min(1).max(60).regex(/^[a-z0-9_]+$/),
  type: z.enum(["text", "number", "date", "single_select", "multi_select", "url", "email"]),
  options: z.array(z.string().trim().min(1)).optional(),
  order: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional()
});

export type CustomFieldInput = z.infer<typeof customFieldInputSchema>;
