import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { AuthContext } from "../../auth/types";

export interface AuthenticatedRequest extends Request {
  user?: AuthContext;
}

export const AuthUser = createParamDecorator(
  (data: keyof AuthContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
