export function parseTimeToMinutes(value: unknown) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatMinutesAsTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

export function getDatePartsInTimeZone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    dayOfWeek: weekdays[parts.weekday] ?? 0
  };
}

function getTimeZoneOffsetMs(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - date.getTime();
}

export function zonedDateTimeToUtc(dateValue: string, timeValue: string, timezone: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0);

  for (let index = 0; index < 2; index += 1) {
    utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0) - getTimeZoneOffsetMs(new Date(utcMs), timezone);
  }

  return new Date(utcMs);
}

export function addDaysToDateValue(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

export function subtractLocalInterval(
  intervals: Array<{ startMinutes: number; endMinutes: number }>,
  block: { startMinutes: number; endMinutes: number }
) {
  return intervals.flatMap((interval) => {
    if (block.endMinutes <= interval.startMinutes || block.startMinutes >= interval.endMinutes) return [interval];

    const remaining: Array<{ startMinutes: number; endMinutes: number }> = [];
    if (block.startMinutes > interval.startMinutes) {
      remaining.push({ startMinutes: interval.startMinutes, endMinutes: block.startMinutes });
    }
    if (block.endMinutes < interval.endMinutes) {
      remaining.push({ startMinutes: block.endMinutes, endMinutes: interval.endMinutes });
    }
    return remaining;
  });
}

export function getWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((Number(d) - Number(yearStart)) / 86400000 + 1) / 7);
}
