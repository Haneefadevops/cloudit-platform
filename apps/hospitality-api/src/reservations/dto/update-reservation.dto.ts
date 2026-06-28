import {
  IsOptional,
  IsUUID,
  IsISO8601,
  IsInt,
  IsString,
  IsEnum,
  Min,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReservationSource, ReservationStatus } from '@prisma/client';

export class UpdateReservationDto {
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsUUID()
  guestId?: string;

  @IsOptional()
  @IsISO8601()
  checkInDate?: string;

  @IsOptional()
  @IsISO8601()
  checkOutDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  adults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  children?: number;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  totalAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  paidAmount?: number;

  @IsOptional()
  @IsEnum(ReservationSource)
  source?: ReservationSource;

  @IsOptional()
  @IsString()
  notes?: string;
}
