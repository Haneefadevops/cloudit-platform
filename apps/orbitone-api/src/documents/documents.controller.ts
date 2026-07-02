import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  DocumentsService,
  DocumentError,
  type DocumentContext,
} from "./documents.service";
import {
  documentInputSchema,
  documentStatusUpdateSchema,
} from "./documents.schemas";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireCRMGuard } from "../common/guards/require-crm.guard";
import type { AuthContext } from "../auth/types";

@Controller("v2/documents")
@UseGuards(SessionAuthGuard, RequireCRMGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  private getContext(user: AuthContext): DocumentContext {
    return { userId: user.id, organizationId: user.organizationId };
  }

  @Get("customers/:id/documents")
  async listCustomerDocuments(
    @AuthUser() user: AuthContext,
    @Param("id") customerId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const documents = await this.documentsService.listDocuments(
        this.getContext(user),
        customerId,
      );
      return { ok: true, data: documents };
    } catch (error) {
      if (error instanceof DocumentError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Post("customers/:id/documents")
  async createCustomerDocument(
    @AuthUser() user: AuthContext,
    @Param("id") customerId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = documentInputSchema.safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid document details." };
    }

    try {
      const document = await this.documentsService.createDocument(
        this.getContext(user),
        customerId,
        input.data,
      );
      res.status(201);
      return { ok: true, data: document };
    } catch (error) {
      if (error instanceof DocumentError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Get(":id/download")
  async download(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const document = await this.documentsService.getDocument(
        this.getContext(user),
        id,
      );
      if (!document) {
        res.status(404);
        return { ok: false, error: "Document not found." };
      }
      const pdf = await this.documentsService.generateDocumentPDF(document);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${document.title.replace(/\s+/g, "_")}.pdf"`,
      );
      return pdf;
    } catch (error) {
      if (error instanceof DocumentError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Put(":id/status")
  async updateStatus(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = documentStatusUpdateSchema.safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid status." };
    }

    try {
      const document = await this.documentsService.updateDocumentStatus(
        this.getContext(user),
        id,
        input.data.status,
      );
      if (!document) {
        res.status(404);
        return { ok: false, error: "Document not found." };
      }
      return { ok: true, data: document };
    } catch (error) {
      if (error instanceof DocumentError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }
}
