import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { DocumentsService } from "./documents.service";

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
}
