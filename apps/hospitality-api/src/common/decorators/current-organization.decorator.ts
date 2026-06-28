import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';

export const CurrentOrganization = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const orgId =
      request.headers['x-organization-id'] ||
      request.query['organizationId'];

    if (!orgId) {
      throw new BadRequestException('Organization ID is required');
    }

    const value = Array.isArray(orgId) ? orgId[0] : orgId;
    return value as string;
  },
);
