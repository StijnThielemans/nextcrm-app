import { SalesError } from "./errors";

/** Postgres integer. A work-day count stays inside that range. */
const MAX_WORK_DAYS = 2_147_483_647;

/**
 * A planning duration: empty, or a whole number from 0 up.
 * Fractions and text stay out. There is no calculation behind the number.
 */
export function parseWorkDays(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || value > MAX_WORK_DAYS) throw new SalesError("workDaysInvalid");
    return value;
  }
  if (typeof value !== "string") throw new SalesError("workDaysInvalid");
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) throw new SalesError("workDaysInvalid");
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_WORK_DAYS) throw new SalesError("workDaysInvalid");
  return parsed;
}
