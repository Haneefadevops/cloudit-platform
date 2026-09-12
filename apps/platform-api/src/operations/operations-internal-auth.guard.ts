import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { operationsConfig } from './operations.config';

/**
 * Internal-only token guard for the operations module. The caller must
 * present the `x-operations-internal-token` header matching the
 * OPERATIONS_INTERNAL_API_TOKEN environment value. Comparison is
 * constant-time. Fails closed when the token is not configured.
 */
@Injectable()
export class OperationsInternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['x-operations-internal-token'];
    const provided = Array.isArray(header) ? header[0] : header;
    const expected = operationsConfig.internalApiToken;

    if (!expected || !provided || provided.length !== expected.length) {
      throw new UnauthorizedException('Unauthorized');
    }

    const providedBuffer = Buffer.from(provided, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Unauthorized');
    }

    return true;
  }
}
