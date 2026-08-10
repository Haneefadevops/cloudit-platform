import { IsNotEmpty, IsString } from 'class-validator';

export class ReplySocialCommentDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}
