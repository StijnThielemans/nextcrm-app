/** Weekgrenzen in Europa/Brussel. Maandag is de eerste dag. */

export const OFFERTE_MAILBOX = "offerte@thielemans.be";

export function staysUntilQuoteSent(sendCount: number): boolean {
  return sendCount === 0;
}

export function brusselsDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

/** Maandag van de Brusselse week, als YYYY-MM-DD. */
export function weekStartKey(date: Date): string {
  const { year, month, day } = brusselsDateParts(date);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

export function isSameBrusselsWeek(left: Date, right: Date): boolean {
  return weekStartKey(left) === weekStartKey(right);
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}
