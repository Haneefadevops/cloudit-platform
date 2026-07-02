import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { Public } from "../common/decorators/public.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CreateCheckInLinkDto } from "./dto/create-check-in-link.dto";
import { SubmitCheckInDto } from "./dto/submit-check-in.dto";
import { GuestPortalService } from "./guest-portal.service";

@ApiTags("guest-portal")
@Controller("guest-portal")
export class GuestPortalController {
  constructor(private readonly guestPortalService: GuestPortalService) {}

  @Post("check-in-links")
  @RequireModule("hospitality", "reservations")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create guest self-check-in link" })
  async createCheckInLink(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateCheckInLinkDto,
  ) {
    return this.guestPortalService.createCheckInLink(organizationId, dto);
  }

  @Public()
  @Get("check-in/:token")
  @ApiOperation({ summary: "Get public self-check-in session" })
  async getPublicSession(@Param("token") token: string) {
    return this.guestPortalService.getPublicSession(token);
  }

  @Public()
  @Post("check-in/:token")
  @ApiOperation({ summary: "Submit public self-check-in details" })
  async submit(@Param("token") token: string, @Body() dto: SubmitCheckInDto) {
    return this.guestPortalService.submit(token, dto);
  }
}
