import { IsNotEmpty, IsUUID, IsISO8601 } from 'class-validator';

export class AvailabilityQueryDto {
  @IsNotEmpty()
  @IsUUID()
  propertyId: string;

  @IsNotEmpty()
  @IsISO8601()
  checkIn: string;

  @IsNotEmpty()
  @IsISO8601()
  checkOut: string;
}
