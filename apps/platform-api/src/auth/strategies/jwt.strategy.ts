import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'cloudit-dev-secret',
    });
  }

  async validate(payload: {
    sub: string;
    orgId: string;
    role: string;
  }) {
    return {
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
    };
  }
}
