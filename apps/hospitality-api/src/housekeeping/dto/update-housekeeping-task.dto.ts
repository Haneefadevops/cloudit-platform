import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  HousekeepingTaskStatus,
  HousekeepingTaskType,
} from "@prisma/client-hospitality";

export class UpdateHousekeepingTaskDto {
  @IsOptional()
  @IsEnum(HousekeepingTaskType)
  type?: HousekeepingTaskType;

  @IsOptional()
  @IsEnum(HousekeepingTaskStatus)
  status?: HousekeepingTaskStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  priority?: number;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
