import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireCRMGuard } from "../common/guards/require-crm.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import type { AuthContext } from "../auth/types";
import { CrmService } from "./crm.service";

@ApiTags("crm")
@Controller("v2/crm")
@UseGuards(RequireCRMGuard)
@RequireModule("orbitone", "crm")
@ApiBearerAuth()
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get("summary")
  @ApiOperation({ summary: "Get CRM summary" })
  async summary(@AuthUser() user: AuthContext) {
    const data = await this.crmService.getCRMSummary(user);
    return { ok: true, data };
  }
}
