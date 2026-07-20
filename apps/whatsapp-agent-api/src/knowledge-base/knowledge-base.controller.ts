import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { SearchDocumentsDto } from './dto/search-documents.dto';
import { CrawlUrlDto } from './dto/crawl-url.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('knowledge-base')
@UseGuards(JwtAuthGuard, AdminGuard)
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Get(':clientId')
  findAll(@Param('clientId') clientId: string) {
    return this.knowledgeBaseService.findAll(clientId);
  }

  @Post(':clientId')
  create(
    @Param('clientId') clientId: string,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.knowledgeBaseService.createDocument(
      clientId,
      dto.title,
      dto.content,
      dto.contentType || 'text',
    );
  }

  @Post(':clientId/upload')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadFiles(
    @Param('clientId') clientId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    return this.knowledgeBaseService.createDocumentsFromFiles(
      clientId,
      files.map((f) => ({ buffer: f.buffer, originalname: f.originalname })),
    );
  }

  @Post(':clientId/search')
  async search(
    @Param('clientId') clientId: string,
    @Body() dto: SearchDocumentsDto,
  ) {
    return this.knowledgeBaseService.search(
      clientId,
      dto.query,
      dto.limit || 5,
    );
  }

  @Delete(':clientId/:documentId')
  remove(
    @Param('clientId') clientId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.knowledgeBaseService.remove(clientId, documentId);
  }

  @Post(':clientId/crawl')
  crawl(
    @Param('clientId') clientId: string,
    @Body() dto: CrawlUrlDto,
  ) {
    return this.knowledgeBaseService.crawlUrl(clientId, dto.url);
  }
}
