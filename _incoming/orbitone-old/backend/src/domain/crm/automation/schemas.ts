import { z } from "zod";

export const automationTriggerSchema = z.enum([
  "customer_created",
  "stage_changed",
  "lifecycle_changed",
  "activity_created",
  "follow_up_created",
  "follow_up_completed"
]);

export const automationActionSchema = z.object({
  type: z.enum(["create_follow_up", "create_activity", "send_webhook"]),
  config: z.record(z.unknown()).default({})
});

export const automationRuleInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  triggerEvent: automationTriggerSchema,
  conditions: z.record(z.unknown()).default({}),
  actions: z.array(automationActionSchema).min(1),
  isActive: z.boolean().optional()
});

export type AutomationRuleInput = z.infer<typeof automationRuleInputSchema>;
