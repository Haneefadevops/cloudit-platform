import { z } from "zod";

export const upgradePlanSchema = z.object({
  plan: z.enum([
    "pro_individual",
    "pro_business_starter",
    "pro_business_growth",
    "pro_business_enterprise",
  ]),
});

export type UpgradePlanInput = z.infer<typeof upgradePlanSchema>;
