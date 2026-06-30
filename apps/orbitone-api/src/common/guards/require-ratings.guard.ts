import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { AuthenticatedRequest } from "../decorators/auth-user.decorator";
import { PlanService } from "../services/plan.service";

@Injectable()
export class RequireRatingsGuard implements CanActivate {
  constructor(private readonly planService: PlanService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException(
        "Ratings are available on Pro Business plans.",
      );
    }
    const plan = this.planService.getUserEffectivePlan(user);
    if (!this.planService.isRatingsEnabled(plan)) {
      throw new ForbiddenException(
        "Ratings are available on Pro Business plans.",
      );
    }
    return true;
  }
}
