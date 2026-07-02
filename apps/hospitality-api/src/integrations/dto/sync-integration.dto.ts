import { IsIn, IsObject, IsOptional } from "class-validator";

export class SyncIntegrationDto {
  @IsIn(["pull", "push", "bidirectional"])
  direction: "pull" | "push" | "bidirectional";

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
