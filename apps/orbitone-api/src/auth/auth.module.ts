import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";
import { OrganizationsModule } from "../organizations/organizations.module";
import { SlugService } from "../common/lib/slug.service";

@Global()
@Module({
  imports: [OrganizationsModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService, SlugService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
