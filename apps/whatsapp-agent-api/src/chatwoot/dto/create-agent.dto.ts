import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateChatwootAgentDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsOptional()
  role?: string = 'agent';
}
