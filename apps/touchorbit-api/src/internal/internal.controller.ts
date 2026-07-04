import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { InternalAuthGuard } from "../common/guards/internal-auth.guard";
import { InternalProvisioningService } from "./internal-provisioning.service";

@Controller("internal")
export class InternalController {
  constructor(
    private readonly provisioningService: InternalProvisioningService,
  ) {}

  @Public()
  @Post("provision-tenant")
  @UseGuards(InternalAuthGuard)
  provision(@Body() body: unknown) {
    return this.provisioningService.provision(body);
  }
}
