import { IsString, IsOptional } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  contentType?: string;
}
