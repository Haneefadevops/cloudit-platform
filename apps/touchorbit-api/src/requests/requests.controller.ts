import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { RequestsService } from "./requests.service";

@ApiTags("requests")
@Controller("requests")
@UseGuards(SessionAuthGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get()
  @RequireModule("touchorbit", "requests")
  @ApiOperation({ summary: "List requests" })
  findAll(@CurrentOrganization() organizationId: string) {
    const rows = this.requestsService.findAll(organizationId);
    return { ok: true, data: rows };
  }
}
