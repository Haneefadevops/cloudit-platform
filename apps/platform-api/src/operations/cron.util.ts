/**
 * Dependency-free 5-field cron next-run calculator.
 *
 * Supports the standard cron fields `minute hour dom month dow` with:
 *   star        every value (asterisk)
 *   star-step   step values (asterisk followed by slash and n, n >= 1)
 *   a-b         ranges
 *   a-b/n       stepped ranges
 *   a/n         every n starting at a
 *   a,b,c       comma lists of the above
 *   numbers     plain values
 *
 * Day-of-week accepts 0-7 (0 and 7 both mean Sunday). There is no special
 * dom/dow union semantics: a candidate minute must match all five fields
 * (the intersection), which matches the n8n schedules this catalogue uses.
 *
 * The schedule is evaluated in its own timezone (default Europe/Malta) via
 * Intl plus pure UTC math — no `Date` local-time dependency, so it is
 * deterministic in tests and in any container timezone. DST transitions
 * are handled by re-resolving the wall clock at each candidate day.
 */

export interface CronSchedule {
  minute: number[];
  hour: number[];
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month1to12: number): number {
  if (month1to12 === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return MONTH_LENGTHS[month1to12 - 1];
}

function parseField(
  field: string,
  min: number,
  max: number,
  dow: boolean,
): Set<number> | null {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const trimmed = part.trim();
    if (trimmed === '') {
      return null;
    }
    const slashIndex = trimmed.indexOf('/');
    const rangePart =
      slashIndex === -1 ? trimmed : trimmed.slice(0, slashIndex);
    const stepPart =
      slashIndex === -1 ? undefined : trimmed.slice(slashIndex + 1);
    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart)) {
        return null;
      }
      step = Number(stepPart);
      if (step < 1) {
        return null;
      }
    }
    let lo = min;
    let hi = max;
    if (rangePart !== '*') {
      const rangeMatch = /^(\d+)(?:-(\d+))?$/.exec(rangePart);
      if (!rangeMatch) {
        return null;
      }
      lo = Number(rangeMatch[1]);
      hi = rangeMatch[2] !== undefined ? Number(rangeMatch[2]) : lo;
      if (stepPart !== undefined && rangeMatch[2] === undefined) {
        // `a/n` means every n starting at a.
        hi = max;
      }
    }
    if (lo < min || hi > max || lo > hi) {
      return null;
    }
    for (let v = lo; v <= hi; v += step) {
      values.add(dow && v === 7 ? 0 : v);
    }
  }
  return values.size > 0 ? values : null;
}

/**
 * Parse a 5-field cron expression. Returns null when the expression is
 * null, empty or unparseable.
 */
export function parseCronExpression(
  expression: string | null | undefined,
): CronSchedule | null {
  if (!expression) {
    return null;
  }
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return null;
  }
  const minute = parseField(fields[0], 0, 59, false);
  const hour = parseField(fields[1], 0, 23, false);
  const dom = parseField(fields[2], 1, 31, false);
  const month = parseField(fields[3], 1, 12, false);
  const dow = parseField(fields[4], 0, 7, true);
  if (!minute || !hour || !dom || !month || !dow) {
    return null;
  }
  return {
    minute: [...minute].sort((a, b) => a - b),
    hour: [...hour].sort((a, b) => a - b),
    dom,
    month,
    dow,
  };
}

export function isValidCronExpression(
  expression: string | null | undefined,
): boolean {
  return parseCronExpression(expression) !== null;
}

interface WallTime {
  year: number;
  month: number; // 1-12
  dom: number; // 1-31
  dow: number; // 0-6, Sunday = 0
  hour: number; // 0-23
  minute: number; // 0-59
  /** Offset of `timeZone` from UTC at this instant, in minutes (UTC = wall - offset). */
  offsetMinutes: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat | null {
  let formatter = formatters.get(timeZone);
  if (formatter) {
    return formatter;
  }
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return null;
  }
  formatters.set(timeZone, formatter);
  return formatter;
}

function wallTimeInZone(date: Date, timeZone: string): WallTime | null {
  const formatter = getFormatter(timeZone);
  if (!formatter) {
    return null;
  }
  const parts = formatter.formatToParts(date);
  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : NaN;
  };
  const year = get('year');
  const month = get('month');
  const dom = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  if ([year, month, dom, hour, minute, second].some(Number.isNaN)) {
    return null;
  }
  const asUtc = Date.UTC(year, month - 1, dom, hour, minute, second);
  const shifted = new Date(asUtc);
  return {
    year,
    month,
    dom,
    dow: shifted.getUTCDay(),
    hour,
    minute,
    offsetMinutes: Math.round((asUtc - date.getTime()) / 60_000),
  };
}

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
/** Search at most ~8 years ahead; every valid schedule occurs well within this. */
const MAX_DAYS = 366 * 8 + 2;

/**
 * Compute the next run of a cron expression strictly after `after`,
 * interpreted in `timeZone` (default Europe/Malta). Returns an ISO 8601
 * UTC timestamp, or null when the expression is unparseable or has no
 * occurrence within the search horizon.
 */
export function nextCronRun(
  expression: string | null | undefined,
  after: Date,
  timeZone = 'Europe/Malta',
): string | null {
  const schedule = parseCronExpression(expression);
  if (!schedule) {
    return null;
  }
  const afterMs = after.getTime();
  const firstMinuteMs =
    Math.floor((afterMs + MINUTE_MS) / MINUTE_MS) * MINUTE_MS;

  for (let dayIndex = 0; dayIndex < MAX_DAYS; dayIndex += 1) {
    const probe = new Date(firstMinuteMs + dayIndex * DAY_MS);
    const day = wallTimeInZone(probe, timeZone);
    if (
      !day ||
      !schedule.month.has(day.month) ||
      !schedule.dom.has(day.dom) ||
      !schedule.dow.has(day.dow)
    ) {
      continue;
    }
    // The wall-clock midnight of this day, expressed in UTC.
    const wallMidnightUtcMs =
      Date.UTC(day.year, day.month - 1, day.dom) -
      day.offsetMinutes * MINUTE_MS;
    for (const hour of schedule.hour) {
      for (const minute of schedule.minute) {
        const candidateMs =
          wallMidnightUtcMs + (hour * 60 + minute) * MINUTE_MS;
        if (candidateMs <= afterMs) {
          continue;
        }
        // Re-resolve the wall clock at the candidate so DST shifts cannot
        // produce an instant that lands on the wrong day.
        const candidateWall = wallTimeInZone(new Date(candidateMs), timeZone);
        if (
          candidateWall &&
          schedule.month.has(candidateWall.month) &&
          schedule.dom.has(candidateWall.dom) &&
          schedule.dow.has(candidateWall.dow) &&
          candidateWall.hour === hour &&
          candidateWall.minute === minute
        ) {
          return new Date(candidateMs).toISOString();
        }
      }
    }
  }
  return null;
}
