import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  StaffAlertsService,
  isOnDuty,
  pickRotated,
  parseTime,
  localParts,
  DEFAULT_ALERT_TIMEZONE,
} from './staff-alerts.service';
import { StaffAlertContactsService } from './staff-alert-contacts.service';

const DIRECTOR = {
  id: 'c-director',
  name: 'Director',
  phone: '94770000001',
  active: true,
  mode: 'always',
  daysOfWeek: [],
  startTime: null,
  endTime: null,
};

const STAFF_A = {
  id: 'c-staff-a',
  name: 'Staff A',
  phone: '94770000002',
  active: true,
  mode: 'scheduled',
  daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  startTime: '09:00',
  endTime: '18:00',
};

const STAFF_B = {
  id: 'c-staff-b',
  name: 'Staff B',
  phone: '94770000003',
  active: true,
  mode: 'scheduled',
  daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  startTime: '09:00',
  endTime: '18:00',
};

// 2026-07-27 is a Monday. 10:00 UTC = 15:30 in Asia/Colombo (UTC+5:30),
// inside the 09:00–18:00 window. 18:00 UTC = 23:30 Colombo — outside.
const MONDAY_DAY_UTC = new Date('2026-07-27T10:00:00Z');
const MONDAY_NIGHT_UTC = new Date('2026-07-27T18:00:00Z');

function setup(options: {
  contacts?: Array<Record<string, unknown>>;
  lastContactId?: string | null;
  staffAlertEnv?: string;
}) {
  const contacts = options.contacts ?? [];
  const prisma = {
    staffAlertContact: {
      findMany: jest.fn().mockResolvedValue(contacts.filter((c) => c.active)),
      count: jest.fn().mockResolvedValue(contacts.length),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => data),
      update: jest.fn().mockImplementation(({ data }) => data),
      delete: jest.fn().mockResolvedValue({}),
    },
    staffAlertRotation: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          options.lastContactId
            ? { id: 'singleton', lastContactId: options.lastContactId }
            : null,
        ),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const sender = { sendWithTemplateFallback: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: (key: string, def?: unknown) =>
      key === 'STAFF_ALERT_WHATSAPP'
        ? options.staffAlertEnv
        : key === 'ALERT_TIMEZONE'
          ? (undefined ?? def)
          : def,
  };
  const service = new StaffAlertsService(
    prisma as never,
    sender as never,
    config as never,
  );
  return { prisma, sender, service };
}

describe('isOnDuty', () => {
  it('matches inside a same-day window (timezone-aware)', () => {
    expect(isOnDuty(STAFF_A, MONDAY_DAY_UTC, DEFAULT_ALERT_TIMEZONE)).toBe(true);
    expect(isOnDuty(STAFF_A, MONDAY_NIGHT_UTC, DEFAULT_ALERT_TIMEZONE)).toBe(false);
  });

  it('respects the day list', () => {
    const sundayOnly = { ...STAFF_A, daysOfWeek: ['sun'] };
    expect(isOnDuty(sundayOnly, MONDAY_DAY_UTC, DEFAULT_ALERT_TIMEZONE)).toBe(false);
  });

  it('handles overnight windows on both legs', () => {
    const night = { ...STAFF_A, daysOfWeek: ['mon'], startTime: '18:00', endTime: '08:00' };
    // Monday 23:30 Colombo — evening leg of Monday's window
    expect(isOnDuty(night, MONDAY_NIGHT_UTC, DEFAULT_ALERT_TIMEZONE)).toBe(true);
    // Tuesday 02:30 Colombo (2026-07-27T21:00Z) — morning leg of Monday's window
    expect(isOnDuty(night, new Date('2026-07-27T21:00:00Z'), DEFAULT_ALERT_TIMEZONE)).toBe(true);
    // Monday 12:00 Colombo — between the legs
    expect(isOnDuty(night, new Date('2026-07-27T06:30:00Z'), DEFAULT_ALERT_TIMEZONE)).toBe(false);
  });

  it('evaluates the window in the configured timezone, not UTC', () => {
    // 04:00 UTC Monday = 09:30 Colombo (on duty) but 04:00 UTC (off duty)
    const at = new Date('2026-07-27T04:00:00Z');
    expect(isOnDuty(STAFF_A, at, DEFAULT_ALERT_TIMEZONE)).toBe(true);
    expect(isOnDuty(STAFF_A, at, 'UTC')).toBe(false);
  });

  it('is off duty with missing schedule fields', () => {
    expect(
      isOnDuty({ daysOfWeek: [], startTime: '09:00', endTime: '18:00' }, MONDAY_DAY_UTC, 'UTC'),
    ).toBe(false);
    expect(
      isOnDuty({ daysOfWeek: ['mon'], startTime: null, endTime: null }, MONDAY_DAY_UTC, 'UTC'),
    ).toBe(false);
  });

  it('parses and rejects times correctly', () => {
    expect(parseTime('09:00')).toBe(540);
    expect(parseTime('23:59')).toBe(1439);
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('nine')).toBeNull();
    expect(parseTime(null)).toBeNull();
  });

  it('localParts returns Colombo weekday and minutes', () => {
    // 2026-07-27T18:30Z = Tuesday 00:00 Colombo
    const parts = localParts(new Date('2026-07-27T18:30:00Z'), DEFAULT_ALERT_TIMEZONE);
    expect(parts.day).toBe('tue');
    expect(parts.minutes).toBe(0);
  });
});

describe('pickRotated', () => {
  it('advances past the last contact and wraps around', () => {
    const onDuty = [STAFF_A, STAFF_B];
    expect(pickRotated(onDuty, null)?.id).toBe('c-staff-a');
    expect(pickRotated(onDuty, 'c-staff-a')?.id).toBe('c-staff-b');
    expect(pickRotated(onDuty, 'c-staff-b')?.id).toBe('c-staff-a');
  });

  it('starts at the beginning when the last contact is off duty', () => {
    const offDutyC = { id: 'c-staff-c' };
    expect(pickRotated([STAFF_A, STAFF_B], offDutyC.id)?.id).toBe('c-staff-a');
  });

  it('returns null with nobody on duty', () => {
    expect(pickRotated([], 'c-staff-a')).toBeNull();
  });
});

describe('StaffAlertsService.resolveRecipients', () => {
  it('always includes every active always-contact', async () => {
    const { service } = setup({ contacts: [DIRECTOR, STAFF_A] });
    const recipients = await service.resolveRecipients(MONDAY_DAY_UTC);
    expect(recipients.map((r) => r.id)).toContain('c-director');
  });

  it('includes exactly one on-duty scheduled contact and persists the rotation', async () => {
    const { prisma, service } = setup({
      contacts: [DIRECTOR, STAFF_A, STAFF_B],
      lastContactId: null,
    });
    const recipients = await service.resolveRecipients(MONDAY_DAY_UTC);
    const scheduled = recipients.filter((r) => r.mode === 'scheduled');
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].id).toBe('c-staff-a');
    expect(prisma.staffAlertRotation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { lastContactId: 'c-staff-a' } }),
    );
  });

  it('rotates to the next on-duty contact on the following alert', async () => {
    const { service } = setup({
      contacts: [DIRECTOR, STAFF_A, STAFF_B],
      lastContactId: 'c-staff-a',
    });
    const recipients = await service.resolveRecipients(MONDAY_DAY_UTC);
    const scheduled = recipients.filter((r) => r.mode === 'scheduled');
    expect(scheduled[0].id).toBe('c-staff-b');
  });

  it('goes only to always-contacts when nobody is on duty', async () => {
    const { prisma, service } = setup({ contacts: [DIRECTOR, STAFF_A] });
    const recipients = await service.resolveRecipients(MONDAY_NIGHT_UTC);
    expect(recipients.map((r) => r.id)).toEqual(['c-director']);
    expect(prisma.staffAlertRotation.upsert).not.toHaveBeenCalled();
  });

  it('excludes inactive contacts', async () => {
    const { service } = setup({
      contacts: [DIRECTOR, { ...STAFF_A, active: false }],
    });
    const recipients = await service.resolveRecipients(MONDAY_DAY_UTC);
    expect(recipients.map((r) => r.id)).toEqual(['c-director']);
  });
});

describe('StaffAlertsService.sendAlert', () => {
  const CLIENT = { metaAccessToken: 'token', whatsappPhoneNumberId: 'pn-1' };

  it('sends to every resolved recipient via the template fallback', async () => {
    const { sender, service } = setup({
      contacts: [DIRECTOR, STAFF_A],
      lastContactId: null,
    });
    await service.sendAlert(CLIENT, 'Top-up request TU-00001: ...');
    const phones = sender.sendWithTemplateFallback.mock.calls.map(
      (c) => c[0].to,
    );
    expect(phones.sort()).toEqual(['94770000001', '94770000002']);
  });

  it('falls back to the STAFF_ALERT_WHATSAPP env when the table is empty', async () => {
    const { sender, service } = setup({
      contacts: [],
      staffAlertEnv: '94779999999',
    });
    await service.sendAlert(CLIENT, 'msg');
    expect(sender.sendWithTemplateFallback).toHaveBeenCalledTimes(1);
    expect(sender.sendWithTemplateFallback.mock.calls[0][0].to).toBe(
      '94779999999',
    );
  });

  it('sends nothing when the table is empty and no env is set', async () => {
    const { sender, service } = setup({ contacts: [] });
    await service.sendAlert(CLIENT, 'msg');
    expect(sender.sendWithTemplateFallback).not.toHaveBeenCalled();
  });

  it('continues with other recipients when one send fails', async () => {
    const { sender, service } = setup({
      contacts: [DIRECTOR, STAFF_A],
      lastContactId: null,
    });
    sender.sendWithTemplateFallback
      .mockRejectedValueOnce(new Error('Meta down'))
      .mockResolvedValueOnce(undefined);
    await expect(service.sendAlert(CLIENT, 'msg')).resolves.toBeUndefined();
    expect(sender.sendWithTemplateFallback).toHaveBeenCalledTimes(2);
  });
});

describe('StaffAlertContactsService validation', () => {
  function contactsSetup(existingByPhone?: Record<string, unknown> | null) {
    const prisma = {
      staffAlertContact: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(existingByPhone ?? null),
        create: jest.fn().mockImplementation(({ data }) => data),
        update: jest.fn().mockImplementation(({ data }) => data),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    return {
      prisma,
      service: new StaffAlertContactsService(prisma as never),
    };
  }

  const validScheduled = {
    name: 'Staff A',
    phone: '94770000002',
    mode: 'scheduled',
    daysOfWeek: ['mon', 'tue'],
    startTime: '09:00',
    endTime: '18:00',
  };

  it('creates an always contact without schedule fields', async () => {
    const { prisma, service } = contactsSetup();
    await service.create({ name: 'Director', phone: '94770000001', mode: 'always' });
    expect(prisma.staffAlertContact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mode: 'always',
        daysOfWeek: [],
        startTime: null,
        endTime: null,
      }),
    });
  });

  it('rejects a bad phone with 400', async () => {
    const { service } = contactsSetup();
    await expect(
      service.create({ ...validScheduled, phone: 'not-a-phone' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ ...validScheduled, phone: '123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duplicate phone with 409', async () => {
    const { service } = contactsSetup({ id: 'other', phone: '94770000002' });
    await expect(service.create(validScheduled)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects scheduled contacts without days or times', async () => {
    const { service } = contactsSetup();
    await expect(
      service.create({ ...validScheduled, daysOfWeek: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ ...validScheduled, startTime: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ ...validScheduled, endTime: 'nine' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid mode', async () => {
    const { service } = contactsSetup();
    await expect(
      service.create({ ...validScheduled, mode: 'sometimes' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes phone formatting before storing', async () => {
    const { prisma, service } = contactsSetup();
    await service.create({ name: 'D', phone: '+94 77 000 0001', mode: 'always' });
    const data = prisma.staffAlertContact.create.mock.calls[0][0].data;
    expect(data.phone).toBe('+94770000001');
  });
});
