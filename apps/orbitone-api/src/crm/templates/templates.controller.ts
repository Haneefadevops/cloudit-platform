import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireCRMGuard } from "../../common/guards/require-crm.guard";
import { RequireModule } from "../../common/decorators/require-module.decorator";
import { AuthUser } from "../../common/decorators/auth-user.decorator";
import type { AuthContext } from "../../auth/types";
import { TemplatesService } from "./templates.service";
import { templateInputSchema } from "./templates.schemas";

@ApiTags("crm-templates")
@Controller("v2/crm/templates")
@UseGuards(RequireCRMGuard)
@RequireModule("orbitone", "crm")
@ApiBearerAuth()
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: "List templates" })
  async findAll(@AuthUser() user: AuthContext) {
    const templates = await this.templatesService.listTemplates(user);
    return { ok: true, data: templates };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: "Create template" })
  async create(@AuthUser() user: AuthContext, @Body() body: unknown) {
    const parsed = templateInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid template details.");
    }
    const template = await this.templatesService.createTemplate(
      user,
      parsed.data,
    );
    return { ok: true, data: template };
  }

  @Put(":id")
  @ApiOperation({ summary: "Update template" })
  async update(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = templateInputSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid template details.");
    }
    const template = await this.templatesService.updateTemplate(
      user,
      id,
      parsed.data,
    );
    if (!template) {
      throw new NotFoundException("Template not found.");
    }
    return { ok: true, data: template };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete template" })
  async remove(@AuthUser() user: AuthContext, @Param("id") id: string) {
    const deleted = await this.templatesService.deleteTemplate(user, id);
    if (!deleted) {
      throw new NotFoundException("Template not found.");
    }
    return { ok: true, data: { deleted: true } };
  }
}
