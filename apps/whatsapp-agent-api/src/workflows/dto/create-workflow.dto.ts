import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  name: string;

  @IsString()
  trigger: string;

  @IsString()
  instructions: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  collectFields?: string[];

  @IsOptional()
  @IsIn(['handoff', 'booking', 'order', 'none'])
  endAction?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}
