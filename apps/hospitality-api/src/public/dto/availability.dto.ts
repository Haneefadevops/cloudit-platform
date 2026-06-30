import { IsDateString, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class PublicAvailabilityDto {
  @IsNotEmpty()
  @IsString()
  propertySlug: string;

  @IsOptional()
  @IsDateString()
  checkInDate?: string;

  @IsOptional()
  @IsDateString()
  checkOutDate?: string;
}
