import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_ROLES_KEY } from "../decorators/require-role.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user ?? {};
    const roles = [
      user.role,
      user.productRole,
      user.hospitalityRole,
      ...(Array.isArray(user.roles) ? user.roles : []),
    ].filter(Boolean);

    if (roles.some((role) => requiredRoles.includes(role))) {
      return true;
    }

    throw new ForbiddenException("Insufficient role for this operation");
  }
}
