import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { AuthenticatedRequest } from "../decorators/auth-user.decorator";
import { PlanService } from "../services/plan.service";

@Injectable()
export class RequireBusinessGuard implements CanActivate {
  constructor(private readonly planService: PlanService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user || !user.organizationId) {
      throw new ForbiddenException(
        "Business accounts are available on Pro Business plans.",
      );
    }
    const plan = this.planService.getUserEffectivePlan(user);
    if (!this.planService.isBusinessPlan(plan)) {
      throw new ForbiddenException(
        "Business accounts are available on Pro Business plans.",
      );
    }
    return true;
  }
}
