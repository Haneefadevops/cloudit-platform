import { IsString, IsOptional, IsNumber } from 'class-validator';

export class SearchDocumentsDto {
  @IsString()
  query: string;

  @IsNumber()
  @IsOptional()
  limit?: number;
}
