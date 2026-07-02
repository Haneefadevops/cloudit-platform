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
import { AutomationService } from "./automation.service";
import { automationRuleInputSchema } from "./automation.schemas";

@ApiTags("crm-automation")
@Controller("v2/crm/automation")
@UseGuards(RequireCRMGuard)
@RequireModule("orbitone", "crm")
@ApiBearerAuth()
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get()
  @ApiOperation({ summary: "List automation rules" })
  async findAll(@AuthUser() user: AuthContext) {
    const rules = await this.automationService.listAutomationRules(user);
    return { ok: true, data: rules };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: "Create automation rule" })
  async create(@AuthUser() user: AuthContext, @Body() body: unknown) {
    const parsed = automationRuleInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid automation rule details.");
    }
    const rule = await this.automationService.createAutomationRule(
      user,
      parsed.data,
    );
    return { ok: true, data: rule };
  }

  @Put(":id")
  @ApiOperation({ summary: "Update automation rule" })
  async update(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = automationRuleInputSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid automation rule details.");
    }
    const rule = await this.automationService.updateAutomationRule(
      user,
      id,
      parsed.data,
    );
    if (!rule) {
      throw new NotFoundException("Automation rule not found.");
    }
    return { ok: true, data: rule };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete automation rule" })
  async remove(@AuthUser() user: AuthContext, @Param("id") id: string) {
    const deleted = await this.automationService.deleteAutomationRule(user, id);
    if (!deleted) {
      throw new NotFoundException("Automation rule not found.");
    }
    return { ok: true, data: { deleted: true } };
  }
}
