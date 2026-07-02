import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { OrganizationsService } from "./organizations.service";

@ApiTags("organizations")
@Controller("organizations")
@UseGuards(SessionAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @RequireModule("touchorbit", "organizations")
  @ApiOperation({ summary: "List organizations" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.organizationsService.findAll(organizationId);
    return { ok: true, data: rows };
  }

  @Get("branches")
  @RequireModule("touchorbit", "organizations")
  @ApiOperation({ summary: "List branches for the current organization" })
  async findBranches(@CurrentOrganization() organizationId: string) {
    const rows = await this.organizationsService.findBranches(organizationId);
    return { ok: true, data: rows };
  }

  @Get("departments")
  @RequireModule("touchorbit", "organizations")
  @ApiOperation({ summary: "List departments for the current organization" })
  async findDepartments(@CurrentOrganization() organizationId: string) {
    const rows = await this.organizationsService.findDepartments(organizationId);
    return { ok: true, data: rows };
  }
}
