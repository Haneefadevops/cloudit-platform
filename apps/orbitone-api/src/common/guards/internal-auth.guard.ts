import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const configured = this.configService.get<string>("INTERNAL_API_TOKEN");
    if (!configured) {
      throw new UnauthorizedException("Internal API token not configured");
    }

    const headerToken = request.headers["x-internal-token"];
    const auth = request.headers.authorization as string | undefined;
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    if (token === configured || bearer === configured) return true;
    throw new UnauthorizedException("Invalid internal API token");
  }
}
