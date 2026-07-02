import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Request } from "express";

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
        if (
          data &&
          typeof data === "object" &&
          ("ok" in data || "success" in data)
        ) {
          return data;
        }
        return {
          ok: true,
          data,
        };
      }),
    );
  }
}
