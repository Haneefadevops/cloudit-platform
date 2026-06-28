import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateRequestDto {
  @ApiProperty({ description: 'Prompt to send to the AI provider' })
  @IsString()
  @IsNotEmpty()
  prompt!: string;
}
