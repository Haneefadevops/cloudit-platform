import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { SlugService } from "../common/lib/slug.service";

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, SlugService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
