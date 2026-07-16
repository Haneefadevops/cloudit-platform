import { IsString, IsOptional } from 'class-validator';

export class CreateChatwootAccountDto {
  @IsString()
  @IsOptional()
  name?: string;
}
