import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { EventTypes } from '../events/event-types';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const orgName = dto.orgName || `${dto.firstName}'s Organization`;
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const slug = orgName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        members: {
          create: {
            role: 'ADMIN',
            organization: {
              create: {
                name: orgName,
                slug: `${slug}-${Date.now().toString(36)}`,
              },
            },
          },
        },
      },
      include: { members: { include: { organization: true } } },
    });

    const tokens = await this.generateTokens(user.id);

    const primaryOrg = user.members?.[0]?.organization;
    void this.eventPublisher.publish(EventTypes.USER_CREATED, {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: primaryOrg?.id,
    });

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { members: { include: { organization: true } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id);

    void this.eventPublisher.publish(EventTypes.USER_LOGIN, {
      userId: user.id,
      email: user.email,
      timestamp: new Date().toISOString(),
    });

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = await this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
    });
    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return this.generateTokens(stored.userId);
  }

  async logout(refreshToken: string) {
    const tokenHash = await this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const token = this.generateRandomToken();
    const tokenHash = await this.hashToken(token);
    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    console.log(`[EMAIL] Password reset for ${email}: token=${token}`);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = await this.hashToken(token);
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, used: false, expiresAt: { gt: new Date() } },
    });
    if (!resetToken) {
      throw new BadRequestException('Invalid or expired token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { members: { include: { organization: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const organizations = user.members.map((m: any) => m.organization);
    return {
      user: this.sanitizeUser(user),
      organizations,
    };
  }

  private async generateTokens(userId: string): Promise<TokenResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { members: { select: { orgId: true, role: true } } },
    });
    const orgId = user?.members?.[0]?.orgId;
    const isAdmin = user?.members?.some((m) => m.role === 'ADMIN') ?? false;
    const accessToken = this.jwtService.sign(
      { sub: userId, orgId, email: user?.email, role: isAdmin ? 'ADMIN' : 'MEMBER' },
      { expiresIn: '15m' },
    );
    const refreshToken = this.generateRandomToken();
    const tokenHash = await this.hashToken(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600000),
      },
    });

    return { accessToken, refreshToken };
  }

  private generateRandomToken(): string {
    return Buffer.from(crypto.randomUUID() + crypto.randomUUID()).toString(
      'base64',
    );
  }

  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
