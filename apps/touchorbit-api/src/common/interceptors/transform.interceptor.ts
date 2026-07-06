import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Request } from "express";

function isEnvelope(data: unknown): data is { ok: boolean } {
  return (
    typeof data === "object" &&
    data !== null &&
    "ok" in data &&
    typeof (data as { ok: unknown }).ok === "boolean"
  );
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url;

    const skipPaths = ["/api/health", "/api/docs", "/health"];
    if (skipPaths.some((skip) => path.startsWith(skip))) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // Controllers that already return { ok, data } or { ok, error }
        // should not be double-wrapped.
        if (isEnvelope(data)) {
          return data;
        }
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
