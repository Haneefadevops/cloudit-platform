import { IsNotEmpty, IsUUID, IsISO8601 } from 'class-validator';

export class ReportQueryDto {
  @IsNotEmpty()
  @IsUUID()
  propertyId: string;

  @IsNotEmpty()
  @IsISO8601()
  startDate: string;

  @IsNotEmpty()
  @IsISO8601()
  endDate: string;
}
