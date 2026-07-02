import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from "@nestjs/common";
import { AuthenticatedRequest } from "./auth-user.decorator";

export const CurrentOrganization = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const orgId = request.user?.organizationId;

    if (!orgId) {
      throw new BadRequestException("Organization context required");
    }

    return orgId;
  },
);
