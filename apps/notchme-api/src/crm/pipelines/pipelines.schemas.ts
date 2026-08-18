import { z } from "zod";

export const pipelineInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const pipelineStageInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  order: z.number().int().min(0).optional().nullable(),
  color: z.string().trim().max(7).nullable().optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
});

export type PipelineInput = z.infer<typeof pipelineInputSchema>;
export type PipelineStageInput = z.infer<typeof pipelineStageInputSchema>;
