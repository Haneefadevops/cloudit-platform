import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Recipient phone number in international format' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ description: 'Message body' })
  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class SendTemplateDto {
  @ApiProperty({ description: 'Recipient phone number in international format' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ description: 'Template ID registered with WhatsApp Business API' })
  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @ApiProperty({ description: 'Template variable data', required: false })
  @IsOptional()
  data?: Record<string, unknown>;
}
