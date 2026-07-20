import { IsUrl } from 'class-validator';

export class CrawlUrlDto {
  @IsUrl({}, { message: 'url must be a valid URL' })
  url: string;
}
