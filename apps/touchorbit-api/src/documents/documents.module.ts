import { Module } from "@nestjs/common";
import {
  DocumentTemplatesController,
  DocumentsController,
} from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  controllers: [DocumentsController, DocumentTemplatesController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
