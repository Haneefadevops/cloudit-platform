import { IsString, IsOptional, IsObject } from 'class-validator';

export class ChatwootWebhookPayloadDto {
  @IsString()
  event!: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}
