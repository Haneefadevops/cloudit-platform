import { z } from "zod";

const lifecycleStageSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "meeting",
  "proposal",
  "customer",
  "lost",
  "archived",
]);

const prioritySchema = z.enum(["low", "medium", "high"]);
const sourceSchema = z.enum(["scan", "booking", "manual", "import"]);

export const bulkActionInputSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum([
    "delete",
    "assign",
    "set_stage",
    "set_lifecycle",
    "set_priority",
    "set_outcome",
  ]),
  payload: z.record(z.unknown()).default({}),
});

export const customerMergeInputSchema = z.object({
  primaryCustomerId: z.string().uuid(),
  secondaryCustomerId: z.string().uuid(),
});

export const customerImportInputSchema = z.object({
  rows: z.array(
    z.object({
      fullName: z.string().min(1),
      email: z.string().email().nullable().optional().or(z.literal("")),
      phone: z.string().max(40).nullable().optional().or(z.literal("")),
      company: z.string().max(120).nullable().optional().or(z.literal("")),
      lifecycleStage: lifecycleStageSchema.optional(),
      priority: prioritySchema.optional(),
      source: sourceSchema.optional(),
      notes: z.string().max(2000).nullable().optional().or(z.literal("")),
    }),
  ),
});

export type BulkActionInput = z.infer<typeof bulkActionInputSchema>;
export type CustomerMergeInput = z.infer<typeof customerMergeInputSchema>;
export type CustomerImportInput = z.infer<typeof customerImportInputSchema>;
