import { z } from "zod";
import type { FeedbackChannel } from "../../../../contracts/orbitone.v2.js";

const feedbackChannels: [FeedbackChannel, ...FeedbackChannel[]] = ["email", "sms", "whatsapp"];

export const feedbackRequestInputSchema = z.object({
  channel: z.enum(feedbackChannels).optional(),
  bookingId: z.string().uuid().optional(),
});
