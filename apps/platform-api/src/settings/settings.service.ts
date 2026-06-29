import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    const settings = await this.prisma.setting.findMany({ where: { orgId } });
    return settings.reduce(
      (acc, s) => {
        acc[s.key] = s.value;
        return acc;
      },
      {} as Record<string, any>,
    );
  }

  async update(orgId: string, dto: any) {
    const keys = Object.keys(dto);
    await this.prisma.$transaction(
      keys.map((key) =>
        this.prisma.setting.upsert({
          where: { key_orgId: { key, orgId } },
          create: { key, value: dto[key], orgId },
          update: { value: dto[key] },
        }),
      ),
    );
    return this.findAll(orgId);
  }
}
