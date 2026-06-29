import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers['x-internal-token'];
    const expected = this.configService.get<string>('INTERNAL_API_TOKEN');

    if (!expected) {
      throw new UnauthorizedException('Internal API token not configured');
    }

    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid internal API token');
    }

    return true;
  }
}
