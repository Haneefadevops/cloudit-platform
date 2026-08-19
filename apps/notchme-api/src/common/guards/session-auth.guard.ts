import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SessionService } from "../../auth/session.service";
import { AuthenticatedRequest } from "../decorators/auth-user.decorator";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.sessionService.getAuthUserWithOrg(request);

    if (!user) {
      throw new UnauthorizedException("Authentication required.");
    }

    request.user = user;
    const verificationRequired =
      this.config.get<string>("NOTCHME_REQUIRE_EMAIL_VERIFICATION") === "true";
    const authPath = request.url.startsWith("/api/v2/auth/");
    if (verificationRequired && !user.emailVerifiedAt && !authPath) {
      throw new ForbiddenException("Verify your email to continue.");
    }
    return true;
  }
}
