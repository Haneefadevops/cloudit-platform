import { Module } from "@nestjs/common";
import { GuestPortalController } from "./guest-portal.controller";
import { GuestPortalService } from "./guest-portal.service";

@Module({
  controllers: [GuestPortalController],
  providers: [GuestPortalService],
})
export class GuestPortalModule {}
