import {
  daysInMonth,
  isValidCronExpression,
  nextCronRun,
  parseCronExpression,
} from './cron.util';

describe('parseCronExpression', () => {
  it('parses a daily schedule', () => {
    const schedule = parseCronExpression('15 7 * * *');
    expect(schedule).not.toBeNull();
    expect([...schedule!.minute]).toEqual([15]);
    expect([...schedule!.hour]).toEqual([7]);
  });

  it('parses */n steps', () => {
    const schedule = parseCronExpression('*/15 * * * *');
    expect([...schedule!.minute]).toEqual([0, 15, 30, 45]);
  });

  it('parses comma lists and ranges', () => {
    const schedule = parseCronExpression('0,30 9-17/4 * * *');
    expect([...schedule!.minute]).toEqual([0, 30]);
    expect([...schedule!.hour]).toEqual([9, 13, 17]);
  });

  it('treats dow 0 and 7 as Sunday', () => {
    const zero = parseCronExpression('0 0 * * 0');
    const seven = parseCronExpression('0 0 * * 7');
    expect(zero!.dow.has(0)).toBe(true);
    expect(seven!.dow.has(0)).toBe(true);
    expect(seven!.dow.has(7)).toBe(false);
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['* * * *'],
    ['* * * * * *'],
    ['61 * * * *'],
    ['* 25 * * *'],
    ['a b c d e'],
    ['*/0 * * * *'],
    ['5-1 * * * *'],
  ])('rejects unparseable expression %p', (expression) => {
    expect(parseCronExpression(expression as string | null)).toBeNull();
    expect(isValidCronExpression(expression as string | null)).toBe(false);
  });
});

describe('daysInMonth', () => {
  it('handles leap years', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2025, 1)).toBe(31);
  });
});

describe('nextCronRun', () => {
  // Europe/Malta is UTC+1 in winter, UTC+2 in summer (last Sunday of March
  // to last Sunday of October).

  it('computes the next daily run in Europe/Malta (winter, UTC+1)', () => {
    const next = nextCronRun('15 7 * * *', new Date('2025-01-10T06:00:00Z'));
    expect(next).toBe('2025-01-10T06:15:00.000Z');
  });

  it('computes the next daily run in Europe/Malta (summer, UTC+2)', () => {
    const next = nextCronRun('15 7 * * *', new Date('2025-06-10T04:00:00Z'));
    expect(next).toBe('2025-06-10T05:15:00.000Z');
  });

  it('is strictly after the reference instant', () => {
    const next = nextCronRun(
      '15 7 * * *',
      new Date('2025-01-10T06:15:00.000Z'),
    );
    expect(next).toBe('2025-01-11T06:15:00.000Z');
  });

  it('computes */5 correctly across the hour boundary', () => {
    const next = nextCronRun('*/5 * * * *', new Date('2025-01-10T10:03:00Z'));
    expect(next).toBe('2025-01-10T10:05:00.000Z');
  });

  it('computes weekly Monday 08:00 runs', () => {
    // 2025-01-10 is a Friday.
    const next = nextCronRun('0 8 * * 1', new Date('2025-01-10T09:00:00Z'));
    expect(next).toBe('2025-01-13T07:00:00.000Z');
  });

  it('computes monthly day-1 runs', () => {
    const next = nextCronRun('0 0 1 * *', new Date('2025-01-15T00:00:00Z'));
    // Feb 1 00:00 Europe/Malta (UTC+1) is Jan 31 23:00Z.
    expect(next).toBe('2025-01-31T23:00:00.000Z');
  });

  it('computes leap-day runs (Feb 29)', () => {
    const next = nextCronRun('0 0 29 2 *', new Date('2025-03-01T00:00:00Z'));
    expect(next).toBe('2028-02-28T23:00:00.000Z');
  });

  it('honours comma lists', () => {
    const next = nextCronRun('0,30 9 * * *', new Date('2025-01-10T08:15:00Z'));
    expect(next).toBe('2025-01-10T08:30:00.000Z');
  });

  it('honours stepped ranges', () => {
    const next = nextCronRun(
      '0 9-17/4 * * *',
      new Date('2025-01-10T10:00:00Z'),
    );
    expect(next).toBe('2025-01-10T12:00:00.000Z');
  });

  it('returns null for null or unparseable expressions', () => {
    expect(nextCronRun(null, new Date('2025-01-10T00:00:00Z'))).toBeNull();
    expect(nextCronRun('banana', new Date('2025-01-10T00:00:00Z'))).toBeNull();
    expect(nextCronRun('', new Date('2025-01-10T00:00:00Z'))).toBeNull();
  });

  it('evaluates in a non-default timezone when requested', () => {
    // UTC-5: 09:30 local = 14:30Z.
    const next = nextCronRun(
      '30 9 * * *',
      new Date('2025-01-10T14:00:00Z'),
      'America/New_York',
    );
    expect(next).toBe('2025-01-10T14:30:00.000Z');
  });
});
