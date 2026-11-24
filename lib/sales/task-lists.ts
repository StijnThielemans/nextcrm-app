import { buildDossierStepper, calendarDaysSince, DOSSIER_FOLLOW_UP_AFTER_DAYS } from "./dossier-step";

export type DossierTaskKind = "toMake" | "inProgress" | "followUp";

export type DossierTaskInput = {
  status: string | null;
  hasDocuments: boolean;
  sentAt: string | null;
  followUpDate: string | null;
  now: Date;
  today: string;
};

function calendarDay(sentAt: string): string | null {
  return /^(\d{4}-\d{2}-\d{2})/.exec(sentAt)?.[1] ?? null;
}

function addCalendarDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** A stored date that only repeats the old one-week send default must wait for the two-week mark. */
function followUpDateIsDue(input: DossierTaskInput): boolean {
  if (input.followUpDate == null || input.followUpDate > input.today) return false;
  const sentDay = input.sentAt ? calendarDay(input.sentAt) : null;
  if (sentDay && input.followUpDate === addCalendarDays(sentDay, 7)) return false;
  return true;
}

/** Open work only. Two weeks after the latest send wins, then dossiers with documents, then new ones still to make. */
export function dossierTaskKind(input: DossierTaskInput): DossierTaskKind | null {
  if (input.status === "GEWONNEN" || input.status === "VERLOREN") return null;
  const sentLongEnough =
    input.sentAt != null && calendarDaysSince(input.sentAt, input.now) >= DOSSIER_FOLLOW_UP_AFTER_DAYS;
  if (sentLongEnough || followUpDateIsDue(input)) return "followUp";
  const step = buildDossierStepper({
    hasDocuments: input.hasDocuments,
    sentAt: input.sentAt,
    status: input.status,
    now: input.now,
  });
  if (step.currentLabel === "Opvolging") return "followUp";
  if (input.hasDocuments) return "inProgress";
  return "toMake";
}
