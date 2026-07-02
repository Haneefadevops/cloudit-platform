import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { AuthenticatedRequest } from "../decorators/auth-user.decorator";

@Injectable()
export class RequireOrgMemberGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user || !user.organizationId) {
      throw new ForbiddenException("Organization membership required.");
    }
    return true;
  }
}
