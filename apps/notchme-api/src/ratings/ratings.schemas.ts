import { z } from "zod";

export const submitRatingSchema = z.object({
  bookingId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  profileId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  review: z.string().trim().max(1000).nullable().optional().or(z.literal("")),
  feedbackToken: z.string().nullable().optional(),
});

export type SubmitRatingInput = z.infer<typeof submitRatingSchema>;
