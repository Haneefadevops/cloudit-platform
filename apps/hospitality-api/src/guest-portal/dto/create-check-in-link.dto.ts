import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class CreateCheckInLinkDto {
  @IsUUID()
  reservationId: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
