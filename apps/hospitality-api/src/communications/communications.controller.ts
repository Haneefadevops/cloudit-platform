import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { CommunicationsService } from "./communications.service";

@ApiTags("communications")
@Controller("communications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Post("daily-summary")
  @ApiOperation({ summary: "Send daily owner summary email" })
  async sendDailySummary(@CurrentOrganization() organizationId: string) {
    return this.communicationsService.sendDailySummaryEmail(organizationId);
  }
}
