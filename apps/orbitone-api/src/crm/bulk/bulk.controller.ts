import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireCRMGuard } from "../../common/guards/require-crm.guard";
import { RequireModule } from "../../common/decorators/require-module.decorator";
import { AuthUser } from "../../common/decorators/auth-user.decorator";
import type { AuthContext } from "../../auth/types";
import { BulkService } from "./bulk.service";
import {
  bulkActionInputSchema,
  customerMergeInputSchema,
  customerImportInputSchema,
} from "./bulk.schemas";

@ApiTags("crm-bulk")
@Controller("v2/crm/bulk")
@UseGuards(RequireCRMGuard)
@RequireModule("orbitone", "crm")
@ApiBearerAuth()
export class BulkController {
  constructor(private readonly bulkService: BulkService) {}

  @Post("actions")
  @HttpCode(200)
  @ApiOperation({ summary: "Run bulk action on customers" })
  async bulkActions(@AuthUser() user: AuthContext, @Body() body: unknown) {
    const parsed = bulkActionInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid bulk action details.");
    }
    const result = await this.bulkService.bulkAction(user, parsed.data);
    return { ok: true, data: result };
  }

  @Get("duplicates")
  @ApiOperation({ summary: "Find duplicate customer groups" })
  async duplicates(@AuthUser() user: AuthContext) {
    const groups = await this.bulkService.findDuplicateGroups(user);
    return { ok: true, data: groups };
  }

  @Post("merge")
  @HttpCode(200)
  @ApiOperation({ summary: "Merge two customers" })
  async merge(@AuthUser() user: AuthContext, @Body() body: unknown) {
    const parsed = customerMergeInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid merge details.");
    }
    await this.bulkService.mergeCustomers(user, parsed.data);
    return { ok: true, data: { merged: true } };
  }

  @Post("import")
  @HttpCode(200)
  @ApiOperation({ summary: "Import customers" })
  async import(@AuthUser() user: AuthContext, @Body() body: unknown) {
    const parsed = customerImportInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid import payload.");
    }
    const result = await this.bulkService.importCustomers(
      user,
      parsed.data.rows,
    );
    return { ok: true, data: result };
  }
}
