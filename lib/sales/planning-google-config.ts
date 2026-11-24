import type { PlanningBoardId } from "./planning";

/** Server-only env for which Google account pushes planning (must have Calendar OAuth on Profile). */
export function planningGoogleAccountEmail(): string | null {
  const value = process.env.PLANNING_GOOGLE_ACCOUNT_EMAIL?.trim().toLowerCase();
  return value || null;
}

export function planningGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() && process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim());
}

const BOARD_ENV: Record<PlanningBoardId, string> = {
  binnendienst: "PLANNING_GOOGLE_CALENDAR_BINNENDIENST",
  buitendienst: "PLANNING_GOOGLE_CALENDAR_BUITENDIENST",
  "dienst-na-verkoop": "PLANNING_GOOGLE_CALENDAR_DIENST_NA_VERKOOP",
};

/** When set, all three boards share one calendar; events are split by private extended property `tiloBoard`. */
export function planningGoogleSingleCalendarId(): string | null {
  const value = process.env.PLANNING_GOOGLE_CALENDAR_ID?.trim();
  return value || null;
}

export function planningGoogleCalendarId(board: PlanningBoardId): string | null {
  const single = planningGoogleSingleCalendarId();
  if (single) return single;
  const key = BOARD_ENV[board];
  const value = process.env[key]?.trim();
  return value || null;
}

export type PlanningGoogleSetup = {
  oauthConfigured: boolean;
  accountEmail: string | null;
  calendars: Record<PlanningBoardId, string | null>;
  mode: "per-board" | "single" | "missing";
};

export function describePlanningGoogleSetup(): PlanningGoogleSetup {
  const single = planningGoogleSingleCalendarId();
  const calendars: Record<PlanningBoardId, string | null> = {
    binnendienst: planningGoogleCalendarId("binnendienst"),
    buitendienst: planningGoogleCalendarId("buitendienst"),
    "dienst-na-verkoop": planningGoogleCalendarId("dienst-na-verkoop"),
  };
  const mode = single ? "single" : Object.values(calendars).some(Boolean) ? "per-board" : "missing";
  return {
    oauthConfigured: planningGoogleOAuthConfigured(),
    accountEmail: planningGoogleAccountEmail(),
    calendars,
    mode,
  };
}