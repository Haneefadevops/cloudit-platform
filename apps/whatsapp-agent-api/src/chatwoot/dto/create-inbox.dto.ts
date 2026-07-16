import { IsString, IsOptional } from 'class-validator';

export class CreateChatwootInboxDto {
  @IsString()
  @IsOptional()
  name?: string;
}
