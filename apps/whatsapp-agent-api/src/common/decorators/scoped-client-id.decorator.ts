import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

export const STAFF_ROLES = ['admin', 'supervisor'];

/**
 * Resolves the clientId a request is allowed to act on:
 * - Staff (admin/supervisor): the `:clientId` route param — staff can manage
 *   any client.
 * - Portal users (client_admin/client_staff): ALWAYS their own
 *   `user.clientId` from the JWT — the clientId in the request is ignored,
 *   so one client can never read or mutate another client's data.
 */
export function resolveScopedClientId(
  user: { role?: string; clientId?: string } | undefined,
  params: { clientId?: string },
): string {
  if (user && STAFF_ROLES.includes(user.role || '')) {
    return params.clientId as string;
  }
  if (user?.clientId) {
    return user.clientId;
  }
  throw new ForbiddenException('No client associated with this account');
}

export const ScopedClientId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return resolveScopedClientId(request.user, request.params);
  },
);
