import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SummarizeRequestDto {
  @ApiProperty({ description: 'Text to summarize' })
  @IsString()
  @IsNotEmpty()
  text!: string;
}
