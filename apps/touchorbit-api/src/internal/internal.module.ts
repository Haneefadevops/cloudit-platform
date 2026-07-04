import { Module } from "@nestjs/common";
import { InternalController } from "./internal.controller";
import { InternalProvisioningService } from "./internal-provisioning.service";

@Module({
  controllers: [InternalController],
  providers: [InternalProvisioningService],
})
export class InternalModule {}
