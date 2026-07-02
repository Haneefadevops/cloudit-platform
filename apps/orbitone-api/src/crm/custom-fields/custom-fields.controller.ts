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
import { CustomFieldsService } from "./custom-fields.service";
import { customFieldInputSchema } from "./custom-fields.schemas";

@ApiTags("crm-custom-fields")
@Controller("v2/crm/custom-fields")
@UseGuards(RequireCRMGuard)
@RequireModule("orbitone", "crm")
@ApiBearerAuth()
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  @ApiOperation({ summary: "List custom fields" })
  async findAll(@AuthUser() user: AuthContext) {
    const fields = await this.customFieldsService.listCustomFields(user);
    return { ok: true, data: fields };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: "Create custom field" })
  async create(@AuthUser() user: AuthContext, @Body() body: unknown) {
    const parsed = customFieldInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid custom field details.");
    }
    const field = await this.customFieldsService.createCustomField(
      user,
      parsed.data,
    );
    return { ok: true, data: field };
  }

  @Put(":id")
  @ApiOperation({ summary: "Update custom field" })
  async update(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = customFieldInputSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid custom field details.");
    }
    const field = await this.customFieldsService.updateCustomField(
      user,
      id,
      parsed.data,
    );
    if (!field) {
      throw new NotFoundException("Custom field not found.");
    }
    return { ok: true, data: field };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete custom field" })
  async remove(@AuthUser() user: AuthContext, @Param("id") id: string) {
    const deleted = await this.customFieldsService.deleteCustomField(user, id);
    if (!deleted) {
      throw new NotFoundException("Custom field not found.");
    }
    return { ok: true, data: { deleted: true } };
  }
}
