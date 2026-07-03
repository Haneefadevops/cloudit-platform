import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.email) {
      throw new ForbiddenException('Authentication required');
    }

    // Any platform ADMIN can manage modules.
    if (user.role === 'ADMIN' || user.role === 'admin') {
      return true;
    }

    const allowed = (process.env.SUPER_ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (allowed.includes(user.email.toLowerCase())) {
      return true;
    }

    throw new ForbiddenException('Super admin access required');
  }
}
