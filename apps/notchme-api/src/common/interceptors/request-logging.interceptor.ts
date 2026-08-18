import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request } from "express";
import { RequestWithId } from "../middleware/request-id.middleware";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  private safePath(path: string) {
    return path.replace(/(\/v2\/book\/manage\/)[^/?]+/, "$1[redacted]");
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const response = context.switchToHttp().getResponse();
    const user = (request as any).user;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.log({
          requestId: request.requestId,
          method: request.method,
          path: this.safePath(request.url),
          statusCode: response.statusCode,
          duration,
          userId: user?.sub || user?.userId || null,
          organizationId: user?.organizationId || user?.orgId || null,
        });
      }),
    );
  }
}
