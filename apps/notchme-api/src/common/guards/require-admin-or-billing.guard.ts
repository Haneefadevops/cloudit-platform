import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { AuthenticatedRequest } from "../decorators/auth-user.decorator";

@Injectable()
export class RequireAdminOrBillingGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user || (user.role !== "admin" && !user.isBillingContact)) {
      throw new ForbiddenException("Admin or billing contact required.");
    }
    return true;
  }
}
