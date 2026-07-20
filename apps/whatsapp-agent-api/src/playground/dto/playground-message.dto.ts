import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PlaygroundHistoryItemDto {
  @IsString()
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class PlaygroundMessageDto {
  @IsString()
  message: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PlaygroundHistoryItemDto)
  history?: PlaygroundHistoryItemDto[];
}
