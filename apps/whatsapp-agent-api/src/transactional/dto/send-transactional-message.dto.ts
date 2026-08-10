import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class SendTransactionalMessageDto {
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/)
  to: string;

  @IsString()
  @IsNotEmpty()
  templateName: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  parameters?: string[];

  @IsOptional()
  @IsString()
  languageCode: string = 'en';
}
