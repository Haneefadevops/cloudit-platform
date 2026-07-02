import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { AuthenticatedRequest } from "../decorators/auth-user.decorator";
import { PlanService } from "../services/plan.service";

@Injectable()
export class RequireCRMGuard implements CanActivate {
  constructor(private readonly planService: PlanService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("CRM is available on Pro Business plans.");
    }
    const plan = this.planService.getUserEffectivePlan(user);
    if (!this.planService.isCRMEnabled(plan)) {
      throw new ForbiddenException("CRM is available on Pro Business plans.");
    }
    return true;
  }
}
