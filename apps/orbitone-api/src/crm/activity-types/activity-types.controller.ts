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
import { ActivityTypesService } from "./activity-types.service";
import { activityTypeInputSchema } from "./activity-types.schemas";

@ApiTags("crm-activity-types")
@Controller("v2/crm/activity-types")
@UseGuards(RequireCRMGuard)
@RequireModule("orbitone", "crm")
@ApiBearerAuth()
export class ActivityTypesController {
  constructor(private readonly activityTypesService: ActivityTypesService) {}

  @Get()
  @ApiOperation({ summary: "List activity types" })
  async findAll(@AuthUser() user: AuthContext) {
    const types = await this.activityTypesService.listActivityTypes(user);
    return { ok: true, data: types };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: "Create activity type" })
  async create(@AuthUser() user: AuthContext, @Body() body: unknown) {
    const parsed = activityTypeInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid activity type details.");
    }
    const type = await this.activityTypesService.createActivityType(
      user,
      parsed.data,
    );
    return { ok: true, data: type };
  }

  @Put(":id")
  @ApiOperation({ summary: "Update activity type" })
  async update(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = activityTypeInputSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid activity type details.");
    }
    const type = await this.activityTypesService.updateActivityType(
      user,
      id,
      parsed.data,
    );
    if (!type) {
      throw new NotFoundException("Activity type not found.");
    }
    return { ok: true, data: type };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete activity type" })
  async remove(@AuthUser() user: AuthContext, @Param("id") id: string) {
    const deleted = await this.activityTypesService.deleteActivityType(
      user,
      id,
    );
    if (!deleted) {
      throw new NotFoundException("Activity type not found.");
    }
    return { ok: true, data: { deleted: true } };
  }
}
