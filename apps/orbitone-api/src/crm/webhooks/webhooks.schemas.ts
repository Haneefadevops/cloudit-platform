import { z } from "zod";

export const webhookSubscriptionInputSchema = z.object({
  url: z.string().trim().url().max(500),
  events: z.array(z.string().trim().min(1)).min(1),
  secret: z.string().trim().max(500).nullable().optional().or(z.literal("")),
});

export type WebhookSubscriptionInput = z.infer<
  typeof webhookSubscriptionInputSchema
>;
