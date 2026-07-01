import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { ExpensesService } from "./expenses.service";

@ApiTags("expenses")
@Controller("expenses")
@UseGuards(SessionAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @RequireModule("touchorbit", "expenses")
  @ApiOperation({ summary: "List expenses" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.expensesService.findAll(organizationId);
    return { ok: true, data: rows };
  }
}
