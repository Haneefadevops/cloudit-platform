import { z } from "zod";
import type { CustomFieldValue } from "../common/contracts/orbitone.v2";

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
const outcomeSchema = z.enum(["in_progress", "won", "lost", "nurture"]);

export const customerInputSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .nullable()
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(40).nullable().optional().or(z.literal("")),
  company: z.string().trim().max(120).nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
  lifecycleStage: lifecycleStageSchema.optional(),
  priority: prioritySchema.optional(),
  nextStep: z.string().trim().max(500).nullable().optional().or(z.literal("")),
  source: sourceSchema.optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  valueAmount: z.number().nonnegative().nullable().optional(),
  valueCurrency: z.string().trim().max(3).optional(),
  expectedCloseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .or(z.literal("")),
  outcome: outcomeSchema.optional(),
  closedReason: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .optional()
    .or(z.literal("")),
  pipelineStageId: z.string().uuid().optional(),
  customFieldValues: z
    .array(
      z.object({
        definitionId: z.string().uuid(),
        value: z.unknown(),
      }) as z.ZodType<CustomFieldValue>,
    )
    .optional(),
});

export const customerLifecycleInputSchema = z.object({
  lifecycleStage: lifecycleStageSchema,
  note: z.string().trim().max(1000).nullable().optional().or(z.literal("")),
});

export const customerAssignInputSchema = z.object({
  assignedToUserId: z.string().uuid(),
});

export const customerCloseInputSchema = z.object({
  outcome: outcomeSchema,
  closedReason: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .optional()
    .or(z.literal("")),
});

export const customerStageMoveInputSchema = z.object({
  pipelineStageId: z.string().uuid(),
  note: z.string().trim().max(1000).nullable().optional().or(z.literal("")),
});

export const customerActivityInputSchema = z.object({
  type: z.enum([
    "note",
    "call",
    "email",
    "meeting",
    "sms",
    "whatsapp",
    "other",
  ]),
  activityTypeDefinitionId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
  occurredAt: z.string().datetime().optional(),
});

export const customerFollowUpInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  dueAt: z.string().datetime(),
});

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

export type CustomerInput = z.infer<typeof customerInputSchema>;
export type CustomerLifecycleInput = z.infer<
  typeof customerLifecycleInputSchema
>;
export type CustomerAssignInput = z.infer<typeof customerAssignInputSchema>;
export type CustomerCloseInput = z.infer<typeof customerCloseInputSchema>;
export type CustomerActivityInput = z.infer<typeof customerActivityInputSchema>;
export type CustomerFollowUpInput = z.infer<typeof customerFollowUpInputSchema>;
export type BulkActionInput = z.infer<typeof bulkActionInputSchema>;
export type CustomerMergeInput = z.infer<typeof customerMergeInputSchema>;
export type CustomerImportInput = z.infer<typeof customerImportInputSchema>;
