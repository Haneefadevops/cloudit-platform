import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ProductModulesService } from "../../modules/modules.service";
import {
  REQUIRED_MODULE_KEY,
  RequiredModuleMetadata,
} from "../decorators/require-module.decorator";

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly modulesService: ProductModulesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredModuleMetadata>(
      REQUIRED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const orgId = request.user?.orgId || request.user?.organizationId;

    if (!orgId) {
      throw new ForbiddenException("Organization context required");
    }

    const enabled = await this.modulesService.isEnabled(
      orgId,
      required.product,
      required.moduleKey,
    );

    if (!enabled) {
      throw new ForbiddenException(
        `Module ${required.moduleKey} is not enabled for this organization`,
      );
    }

    return true;
  }
}
