import { z } from "zod";

export const checkoutSchema = z
  .object({
    product: z.enum(["founding_pro", "teams"]),
    interval: z.enum(["monthly", "annual"]),
  })
  .strict();

export type CheckoutInput = z.infer<typeof checkoutSchema>;
