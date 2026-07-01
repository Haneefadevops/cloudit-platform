import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { TrainingService } from "./training.service";

@ApiTags("training")
@Controller("training")
@UseGuards(SessionAuthGuard)
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get()
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "List training" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.trainingService.findAll(organizationId);
    return { ok: true, data: rows };
  }
}
