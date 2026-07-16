import { IsString, IsOptional } from 'class-validator';

export class CreateChatwootContactDto {
  @IsString()
  phone!: string;

  @IsString()
  @IsOptional()
  name?: string;
}
