import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { z } from "zod";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { DocumentsService } from "./documents.service";

const documentSchema = z.object({
  template_id: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  employee_id: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  status: z.string().optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  status: z.string().optional(),
  signature_url: z.string().optional().nullable(),
  signatureUrl: z.string().optional().nullable(),
  signed_at: z.string().optional().nullable(),
  signedAt: z.string().optional().nullable(),
  signed_ip: z.string().optional().nullable(),
  signedIp: z.string().optional().nullable(),
  signed_latitude: z.coerce.number().optional().nullable(),
  signedLatitude: z.coerce.number().optional().nullable(),
  signed_longitude: z.coerce.number().optional().nullable(),
  signedLongitude: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const templateSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
});

@ApiTags("documents")
@Controller("documents")
@UseGuards(SessionAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequireModule("touchorbit", "documents")
  @ApiOperation({ summary: "List documents" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.documentsService.findAll(organizationId);
    return { ok: true, data: rows };
  }

  @Post()
  @RequireModule("touchorbit", "documents")
  @ApiOperation({ summary: "Send a document" })
  async create(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Body() body: unknown,
  ) {
    const parsed = documentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid document payload");
    }
    const templateId = parsed.data.template_id ?? parsed.data.templateId;
    const employeeId = parsed.data.employee_id ?? parsed.data.employeeId;
    if (!templateId || !employeeId) {
      throw new BadRequestException("template_id and employee_id are required");
    }
    const row = await this.documentsService.create(organizationId, {
      templateId,
      employeeId,
      senderId: userId,
      title: parsed.data.title,
      content: parsed.data.content,
      notes: parsed.data.notes ?? null,
      status: parsed.data.status,
    });
    return { ok: true, data: row };
  }

  @Get(":id")
  @RequireModule("touchorbit", "documents")
  @ApiOperation({ summary: "Get document" })
  async findOne(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.documentsService.findOne(organizationId, id);
    return { ok: true, data: row };
  }

  @Patch(":id")
  @RequireModule("touchorbit", "documents")
  @ApiOperation({ summary: "Update document" })
  async update(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid document payload");
    }
    const row = await this.documentsService.update(organizationId, id, {
      title: parsed.data.title,
      content: parsed.data.content,
      status: parsed.data.status,
      signatureUrl: parsed.data.signature_url ?? parsed.data.signatureUrl,
      signedAt: parsed.data.signed_at ?? parsed.data.signedAt,
      signedIp: parsed.data.signed_ip ?? parsed.data.signedIp,
      signedLatitude:
        parsed.data.signed_latitude ?? parsed.data.signedLatitude,
      signedLongitude:
        parsed.data.signed_longitude ?? parsed.data.signedLongitude,
      notes: parsed.data.notes,
    });
    return { ok: true, data: row };
  }

  @Delete(":id")
  @RequireModule("touchorbit", "documents")
  @ApiOperation({ summary: "Delete document" })
  async delete(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const result = await this.documentsService.delete(organizationId, id);
    return { ok: true, data: result };
  }
}

@ApiTags("document-templates")
@Controller("document-templates")
@UseGuards(SessionAuthGuard)
export class DocumentTemplatesController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequireModule("touchorbit", "documents")
  @ApiOperation({ summary: "List document templates" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.documentsService.findTemplates(organizationId);
    return { ok: true, data: rows };
  }

  @Post()
  @RequireModule("touchorbit", "documents")
  @ApiOperation({ summary: "Create document template" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = templateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid document template payload");
    }
    const row = await this.documentsService.createTemplate(
      organizationId,
      parsed.data,
    );
    return { ok: true, data: row };
  }
}
