import type { PlanningBoardId } from "./planning";

export const TILO_PLANNING_GOOGLE_SOURCE = "tilo-planning";

export type PlanningGoogleExtended = {
  tiloBoard: PlanningBoardId;
  tiloJobId: string;
  tiloKind: string;
};

export type PlanningGoogleBoardStatus = {
  ready: boolean;
  reason:
    | "ready"
    | "oauth_missing"
    | "calendar_missing"
    | "account_email_missing"
    | "connection_missing"
    | "connection_readonly"
    | "sync_error";
  message: string;
  accountEmail: string | null;
  calendarId: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};