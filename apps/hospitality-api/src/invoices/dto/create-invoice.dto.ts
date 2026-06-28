import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsISO8601,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsUUID()
  reservationId: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  subtotal?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
