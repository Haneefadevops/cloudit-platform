import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;

    if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const handler = context.getHandler().name;
    const controller = context.getClass().name;
    const user = (request as any).user;
    const orgId = request.params.orgId || request.body?.orgId || request.query?.orgId;

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.prisma.auditLog.create({
            data: {
              action: `${method} ${controller}.${handler}`,
              entityType: controller.replace('Controller', ''),
              entityId: String(request.params.id || request.params.memberId || 'unknown'),
              userId: user?.sub || null,
              orgId: orgId || null,
              metadata: {
                body: this.sanitizeBody(request.body),
                params: request.params,
              },
              ipAddress: request.ip || request.socket?.remoteAddress || null,
              userAgent: request.headers['user-agent'] || null,
            },
          });
        } catch (err) {
          console.error('Audit log failed:', err);
        }
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;
    const sanitized = { ...body };
    if (sanitized.password) sanitized.password = '[REDACTED]';
    if (sanitized.newPassword) sanitized.newPassword = '[REDACTED]';
    if (sanitized.token) sanitized.token = '[REDACTED]';
    return sanitized;
  }
}
