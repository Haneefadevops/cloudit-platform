import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { AuthenticatedRequest } from "../decorators/auth-user.decorator";
import { UserRole } from "../contracts/orbitone.v2";

@Injectable()
export class RequireRoleGuard implements CanActivate {
  constructor(readonly allowedRoles: UserRole[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user || !this.allowedRoles.includes(user.role)) {
      throw new ForbiddenException("You do not have permission to do that.");
    }
    return true;
  }
}

export function RequireRole(...roles: UserRole[]): CanActivate {
  return new RequireRoleGuard(roles);
}
