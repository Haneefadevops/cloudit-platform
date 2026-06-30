import { z } from "zod";
import type { AccountLifecycleStage } from "../../../../contracts/orbitone.v2.js";

const lifecycleStages: [AccountLifecycleStage, ...AccountLifecycleStage[]] = [
  "prospect",
  "qualified",
  "customer",
  "churned",
  "archived",
];

export const accountInputSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).optional(),
  industry: z.string().max(120).nullable().optional(),
  website: z.string().max(255).nullable().optional(),
  billingAddress: z.string().max(500).nullable().optional(),
  taxId: z.string().max(120).nullable().optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  lifecycleStage: z.enum(lifecycleStages).optional(),
  isPublic: z.boolean().optional(),
});

export const connectionResponseSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
});
