import { Module } from "@nestjs/common";
import { SlugService } from "../common/lib/slug.service";
import { InternalController } from "./internal.controller";
import { InternalProvisioningService } from "./internal-provisioning.service";

@Module({
  controllers: [InternalController],
  providers: [InternalProvisioningService, SlugService],
})
export class InternalModule {}
