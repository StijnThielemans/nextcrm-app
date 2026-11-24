/** Calendar dates for the sales dashboard. Days are YYYY-MM-DD in Europe/Brussels. */

export const DASHBOARD_TIME_ZONE = "Europe/Brussels";

export const PERIOD_PRESETS = [
  "vandaag",
  "week",
  "maand",
  "vorige-maand",
  "kwartaal",
  "jaar",
  "vorig-jaar",
  "aangepast",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export type DateRange = { start: string; end: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function calendarDate(date: Date, timeZone = DASHBOARD_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "numeric",
  }).format(date);
}

export function instantDate(iso: string | null | undefined, timeZone = DASHBOARD_TIME_ZONE): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return calendarDate(date, timeZone);
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function inclusiveDays(start: string, end: string): number {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const diff = Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds);
  return Math.round(diff / 86_400_000) + 1;
}

/** The window of the same length immediately before `start`. */
export function previousPeriod(range: DateRange): DateRange {
  const days = inclusiveDays(range.start, range.end);
  const end = addDays(range.start, -1);
  return { start: addDays(end, -(days - 1)), end };
}

export function mondayOf(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(iso, weekday === 0 ? -6 : 1 - weekday);
}

function monthStart(iso: string, monthDelta: number): string {
  const [year, month] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + monthDelta, 1));
  return date.toISOString().slice(0, 10);
}

function monthEnd(iso: string): string {
  return addDays(monthStart(iso, 1), -1);
}

function isDay(value: string | undefined): value is string {
  return Boolean(value && DAY.test(value));
}

export function resolvePeriod(
  input: { preset?: string; from?: string; to?: string },
  today: string,
): { preset: PeriodPreset; range: DateRange; previous: DateRange } {
  const preset = PERIOD_PRESETS.includes(input.preset as PeriodPreset) ? (input.preset as PeriodPreset) : "maand";
  let range: DateRange;
  if (preset === "vandaag") range = { start: today, end: today };
  else if (preset === "week") range = { start: mondayOf(today), end: today };
  else if (preset === "vorige-maand") {
    const start = monthStart(today, -1);
    range = { start, end: monthEnd(start) };
  } else if (preset === "kwartaal") {
    const month = Number(today.slice(5, 7));
    const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
    range = { start: `${today.slice(0, 4)}-${String(startMonth).padStart(2, "0")}-01`, end: today };
  } else if (preset === "jaar") range = { start: `${today.slice(0, 4)}-01-01`, end: today };
  else if (preset === "vorig-jaar") {
    const year = Number(today.slice(0, 4)) - 1;
    range = { start: `${year}-01-01`, end: `${year}-12-31` };
  } else if (preset === "aangepast" && isDay(input.from) && isDay(input.to) && input.from <= input.to) {
    range = { start: input.from, end: input.to };
  } else if (preset === "aangepast") {
    range = { start: monthStart(today, 0), end: today };
    return { preset: "maand", range, previous: previousPeriod(range) };
  } else range = { start: monthStart(today, 0), end: today };
  return { preset, range, previous: previousPeriod(range) };
}

export type ChartBucket = { start: string; end: string; label: string };

function labelDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function labelMonth(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-BE", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/** Daily up to 62 days, then weekly, then monthly. Buckets stay inside the selected period. */
export function chartBuckets(range: DateRange): ChartBucket[] {
  const days = inclusiveDays(range.start, range.end);
  if (days <= 62) {
    const buckets: ChartBucket[] = [];
    for (let day = range.start; day <= range.end; day = addDays(day, 1)) {
      buckets.push({ start: day, end: day, label: labelDay(day) });
    }
    return buckets;
  }
  if (days <= 180) {
    const buckets: ChartBucket[] = [];
    let cursor = range.start;
    while (cursor <= range.end) {
      const weekEnd = addDays(mondayOf(cursor), 6);
      const end = weekEnd < range.end ? weekEnd : range.end;
      buckets.push({ start: cursor, end, label: labelDay(cursor) });
      cursor = addDays(end, 1);
    }
    return buckets;
  }
  const buckets: ChartBucket[] = [];
  let cursor = range.start;
  while (cursor <= range.end) {
    const endOfMonth = monthEnd(cursor);
    const end = endOfMonth < range.end ? endOfMonth : range.end;
    buckets.push({ start: cursor, end, label: labelMonth(cursor) });
    cursor = addDays(end, 1);
  }
  return buckets;
}
