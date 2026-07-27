import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseTime } from './staff-alerts.service';

const DAY_CODES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const MODES = ['always', 'scheduled'] as const;

export interface StaffAlertContactInput {
  name?: string;
  phone?: string;
  active?: boolean;
  mode?: string;
  daysOfWeek?: unknown;
  startTime?: string | null;
  endTime?: string | null;
}

/** Normalizes a phone to digits with optional leading +; null when invalid. */
function normalizePhone(phone: string | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s()-]/g, '');
  return /^\+?\d{7,15}$/.test(cleaned) ? cleaned : null;
}

function normalizeDays(days: unknown): string[] {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.filter((d) => DAY_CODES.includes(d as string)))] as string[];
}

@Injectable()
export class StaffAlertContactsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.staffAlertContact.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(data: StaffAlertContactInput) {
    const validated = await this.validate(data);
    return this.prisma.staffAlertContact.create({ data: validated });
  }

  async update(id: string, data: StaffAlertContactInput) {
    const existing = await this.prisma.staffAlertContact.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Alert contact not found');

    // Merge so a mode switch (or partial edit) is validated as a whole
    const merged: StaffAlertContactInput = {
      name: data.name ?? existing.name,
      phone: data.phone ?? existing.phone,
      active: data.active ?? existing.active,
      mode: data.mode ?? existing.mode,
      daysOfWeek: data.daysOfWeek ?? existing.daysOfWeek,
      startTime: data.startTime !== undefined ? data.startTime : existing.startTime,
      endTime: data.endTime !== undefined ? data.endTime : existing.endTime,
    };
    const validated = await this.validate(merged, id);
    return this.prisma.staffAlertContact.update({
      where: { id },
      data: validated,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.staffAlertContact.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Alert contact not found');
    return this.prisma.staffAlertContact.delete({ where: { id } });
  }

  private async validate(data: StaffAlertContactInput, excludeId?: string) {
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('Name is required');

    const phone = normalizePhone(data.phone);
    if (!phone) {
      throw new BadRequestException(
        'Phone must be 7–15 digits, optionally starting with + (e.g. 9477XXXXXXX)',
      );
    }

    const duplicate = await this.prisma.staffAlertContact.findUnique({
      where: { phone },
    });
    if (duplicate && duplicate.id !== excludeId) {
      throw new ConflictException('A contact with this phone already exists');
    }

    if (!MODES.includes(data.mode as never)) {
      throw new BadRequestException(`Mode must be one of: ${MODES.join(', ')}`);
    }

    if (data.mode === 'scheduled') {
      const days = normalizeDays(data.daysOfWeek);
      if (!days.length) {
        throw new BadRequestException(
          'Scheduled contacts need at least one day of the week',
        );
      }
      if (
        parseTime(data.startTime) === null ||
        parseTime(data.endTime) === null
      ) {
        throw new BadRequestException(
          'Scheduled contacts need start and end times (HH:MM)',
        );
      }
      return {
        name,
        phone,
        active: data.active ?? true,
        mode: 'scheduled',
        daysOfWeek: days,
        startTime: (data.startTime as string).trim(),
        endTime: (data.endTime as string).trim(),
      };
    }

    return {
      name,
      phone,
      active: data.active ?? true,
      mode: 'always',
      daysOfWeek: [],
      startTime: null,
      endTime: null,
    };
  }
}
