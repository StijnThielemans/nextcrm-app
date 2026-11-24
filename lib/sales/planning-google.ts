import type { calendar_v3 } from "googleapis";
import { prismadb } from "@/lib/prisma";
import { getCalendarClientForConnection } from "@/lib/crm/calendar/google";
import {
  addDays,
  asDate,
  boardForChassis,
  boardForGlass,
  dateKey,
  jobId,
  parseJobId,
  planSpan,
  planningBlockTitle,
  planningCrewById,
  spanDays,
  type PlanningAssignmentView,
  type PlanningBoardId,
  type PlanningJobDraft,
  type PlanningJobView,
} from "./planning";
import {
  describePlanningGoogleSetup,
  planningGoogleAccountEmail,
  planningGoogleCalendarId,
  planningGoogleSingleCalendarId,
} from "./planning-google-config";
import type { PlanningGoogleBoardStatus, PlanningGoogleExtended } from "./planning-google-types";
import { TILO_PLANNING_GOOGLE_SOURCE } from "./planning-google-types";

const BOARD_PROP = "tiloBoard";
const JOB_PROP = "tiloJobId";
const KIND_PROP = "tiloKind";

type ConnectionRow = {
  id: string;
  accountEmail: string;
  refreshTokenEncrypted: string;
  scopeLevel: string;
};

export async function resolvePlanningGoogleConnection(): Promise<ConnectionRow | null> {
  const email = planningGoogleAccountEmail();
  if (!email) return null;
  const row = await prismadb.calendarConnection.findFirst({
    where: { accountEmail: email, provider: "google", isActive: true },
    select: { id: true, accountEmail: true, refreshTokenEncrypted: true, scopeLevel: true },
  });
  return row;
}

export function buildPlanningGoogleStatus(
  board: PlanningBoardId,
  input: {
    connection: ConnectionRow | null;
    lastSyncedAt?: Date | null;
    lastError?: string | null;
  },
): PlanningGoogleBoardStatus {
  const setup = describePlanningGoogleSetup();
  const calendarId = planningGoogleCalendarId(board);
  const accountEmail = setup.accountEmail;
  const base = {
    accountEmail,
    calendarId,
    lastSyncedAt: input.lastSyncedAt?.toISOString() ?? null,
    lastError: input.lastError ?? null,
  };

  if (!setup.oauthConfigured) {
    return {
      ready: false,
      reason: "oauth_missing",
      message: "Zet GOOGLE_CALENDAR_CLIENT_ID en GOOGLE_CALENDAR_CLIENT_SECRET op de server.",
      ...base,
    };
  }
  if (!calendarId) {
    return {
      ready: false,
      reason: "calendar_missing",
      message:
        "Zet PLANNING_GOOGLE_CALENDAR_ID (één agenda) of de drie PLANNING_GOOGLE_CALENDAR_*-variabelen voor binnendienst, buitendienst en dienst na verkoop.",
      ...base,
    };
  }
  if (!accountEmail) {
    return {
      ready: false,
      reason: "account_email_missing",
      message: "Zet PLANNING_GOOGLE_ACCOUNT_EMAIL op het Google-account dat de planning-agenda’s beheert.",
      ...base,
    };
  }
  if (!input.connection) {
    return {
      ready: false,
      reason: "connection_missing",
      message: `Koppel ${accountEmail} onder Profiel → Agenda (Google Calendar, schrijfrechten).`,
      ...base,
    };
  }
  if (input.connection.scopeLevel !== "readwrite") {
    return {
      ready: false,
      reason: "connection_readonly",
      message: `Google Agenda voor ${accountEmail} heeft alleen leesrechten. Verbind opnieuw met schrijfrechten.`,
      ...base,
    };
  }
  if (input.lastError) {
    return {
      ready: false,
      reason: "sync_error",
      message: input.lastError,
      ...base,
    };
  }
  return {
    ready: true,
    reason: "ready",
    message: planningGoogleSingleCalendarId()
      ? "Google Agenda gekoppeld (één agenda, onderscheiden per dienst)."
      : "Google Agenda gekoppeld voor deze planning.",
    ...base,
  };
}

function eventBoard(props: Record<string, string> | null | undefined, calendarBoard: PlanningBoardId): PlanningBoardId | null {
  const raw = props?.[BOARD_PROP];
  if (raw === "binnendienst" || raw === "buitendienst" || raw === "dienst-na-verkoop") return raw;
  return planningGoogleSingleCalendarId() ? calendarBoard : null;
}

function parseExtended(ev: calendar_v3.Schema$Event): PlanningGoogleExtended | null {
  const priv = ev.extendedProperties?.private;
  if (!priv?.[JOB_PROP]) return null;
  const board = priv[BOARD_PROP];
  if (board !== "binnendienst" && board !== "buitendienst" && board !== "dienst-na-verkoop") return null;
  return {
    tiloBoard: board,
    tiloJobId: priv[JOB_PROP],
    tiloKind: priv[KIND_PROP] ?? "manual",
  };
}

function allDaySpan(ev: calendar_v3.Schema$Event): { start: string; end: string } | null {
  const start = ev.start?.date;
  const end = ev.end?.date;
  if (!start || !end) return null;
  const inclusiveEnd = addDays(end, -1);
  if (inclusiveEnd < start) return null;
  return { start, end: inclusiveEnd };
}

function crewLines(assignments: PlanningAssignmentView[], jobIdKey: string, day: string): string[] {
  return assignments
    .filter((row) => row.jobId === jobIdKey && row.day === day)
    .map((row) => planningCrewById(row.resource)?.name ?? row.resource);
}

function buildDescription(job: PlanningJobDraft | PlanningJobView, assignments: PlanningAssignmentView[]): string {
  const lines = [
    job.projectNumber,
    job.customer,
    job.place,
    planningBlockTitle(job.kind, job.workDays, job.text),
  ].filter(Boolean);
  const crew = job.days.flatMap((day) => crewLines(assignments, job.id, day));
  if (crew.length) lines.push(`Ploeg: ${[...new Set(crew)].join(", ")}`);
  lines.push(`Bron: ${TILO_PLANNING_GOOGLE_SOURCE}`);
  return lines.filter(Boolean).join("\n");
}

export function buildGoogleEventPayload(
  board: PlanningBoardId,
  job: PlanningJobDraft | PlanningJobView,
  assignments: PlanningAssignmentView[],
): calendar_v3.Schema$Event | null {
  if (!job.start || !job.end || !job.days.length) return null;
  const title =
    [job.projectNumber, job.customer, planningBlockTitle(job.kind, job.workDays, job.text)].filter(Boolean).join(" · ") ||
    job.text ||
    "Planning";
  const exclusiveEnd = addDays(job.end, 1);
  return {
    summary: title,
    description: buildDescription(job, assignments),
    location: job.place ?? undefined,
    start: { date: job.start },
    end: { date: exclusiveEnd },
    extendedProperties: {
      private: {
        [BOARD_PROP]: board,
        [JOB_PROP]: job.id,
        [KIND_PROP]: job.kind,
      },
    },
  };
}

async function loadLink(board: PlanningBoardId, jobKey: string) {
  return prismadb.crm_PlanningGoogleLinks.findUnique({
    where: { board_job_key: { board: boardEnum(board), job_key: jobKey } },
  });
}

function boardEnum(board: PlanningBoardId) {
  if (board === "binnendienst") return "BINNENDIENST" as const;
  if (board === "buitendienst") return "BUITENDIENST" as const;
  return "DIENST_NA_VERKOOP" as const;
}

function boardFromEnum(value: string): PlanningBoardId | null {
  if (value === "BINNENDIENST") return "binnendienst";
  if (value === "BUITENDIENST") return "buitendienst";
  if (value === "DIENST_NA_VERKOOP") return "dienst-na-verkoop";
  return null;
}

export async function pushPlanningJobToGoogle(
  board: PlanningBoardId,
  job: PlanningJobDraft | PlanningJobView,
  assignments: PlanningAssignmentView[],
): Promise<void> {
  const connection = await resolvePlanningGoogleConnection();
  const calendarId = planningGoogleCalendarId(board);
  if (!connection || connection.scopeLevel !== "readwrite" || !calendarId) return;
  const client = getCalendarClientForConnection(connection);
  const body = buildGoogleEventPayload(board, job, assignments);
  const link = await loadLink(board, job.id);

  if (!body) {
    if (link) {
      await client.events.delete({ calendarId: link.google_calendar_id, eventId: link.google_event_id }).catch(() => undefined);
      await prismadb.crm_PlanningGoogleLinks.delete({ where: { id: link.id } });
    }
    return;
  }

  if (link) {
    const updated = await client.events.patch({
      calendarId: link.google_calendar_id,
      eventId: link.google_event_id,
      requestBody: body,
    });
    await prismadb.crm_PlanningGoogleLinks.update({
      where: { id: link.id },
      data: { etag: updated.data.etag ?? null, updatedAt: new Date() },
    });
    return;
  }

  const inserted = await client.events.insert({ calendarId, requestBody: body });
  if (!inserted.data.id) return;
  await prismadb.crm_PlanningGoogleLinks.create({
    data: {
      board: boardEnum(board),
      job_key: job.id,
      google_event_id: inserted.data.id,
      google_calendar_id: calendarId,
      connection_id: connection.id,
      etag: inserted.data.etag ?? null,
    },
  });
}

async function applyInboundSpan(jobKey: string, span: { start: string; end: string }) {
  const parsed = parseJobId(jobKey);
  if (!parsed) return;
  const days = spanDays(span.start, span.end);
  if (!days.length) return;
  if (parsed.kind === "chassis" || parsed.kind === "glass") {
    const data =
      parsed.kind === "chassis"
        ? { chassis_plan_start: asDate(span.start), chassis_plan_end: asDate(span.end) }
        : { glass_plan_start: asDate(span.start), glass_plan_end: asDate(span.end) };
    await prismadb.crm_Opportunities.update({ where: { id: parsed.id }, data });
    return;
  }
  if (parsed.kind === "office") {
    await prismadb.crm_Opportunities.update({
      where: { id: parsed.id },
      data: { office_plan_start: asDate(span.start), office_plan_end: asDate(span.end) },
    });
    return;
  }
  if (parsed.kind === "manual") {
    await prismadb.crm_PlanningItems.update({
      where: { id: parsed.id },
      data: { plan_start: asDate(span.start), plan_end: asDate(span.end) },
    });
  }
}

export async function pullPlanningWeekFromGoogle(
  board: PlanningBoardId,
  weekStart: string,
  weekEnd: string,
  jobs: PlanningJobView[],
  assignments: PlanningAssignmentView[],
): Promise<{ jobs: PlanningJobView[]; assignments: PlanningAssignmentView[]; status: PlanningGoogleBoardStatus }> {
  const connection = await resolvePlanningGoogleConnection();
  const calendarId = planningGoogleCalendarId(board);
  let lastError: string | null = null;
  if (!connection || !calendarId) {
    return {
      jobs,
      assignments,
      status: buildPlanningGoogleStatus(board, { connection, lastError }),
    };
  }

  try {
    const client = getCalendarClientForConnection(connection);
    const response = await client.events.list({
      calendarId,
      timeMin: `${weekStart}T00:00:00.000Z`,
      timeMax: `${addDays(weekEnd, 1)}T00:00:00.000Z`,
      singleEvents: true,
      showDeleted: false,
      maxResults: 250,
    });
    const events = response.data.items ?? [];
    const byJobId = new Map(jobs.map((job) => [job.id, job]));

    for (const ev of events) {
      const ext = parseExtended(ev);
      const span = allDaySpan(ev);
      if (!ext || !span) continue;
      const eventBoardId = eventBoard(ev.extendedProperties?.private ?? null, board);
      if (eventBoardId !== board) continue;
      await applyInboundSpan(ext.tiloJobId, span);
      const existing = byJobId.get(ext.tiloJobId);
      if (existing) {
        byJobId.set(ext.tiloJobId, { ...existing, start: span.start, end: span.end, days: spanDays(span.start, span.end) });
      }
    }

    const merged = [...byJobId.values()];
    const meta = await prismadb.crm_PlanningGoogleSyncMeta.findUnique({
      where: { board: boardEnum(board) },
    });

    await recordPlanningGoogleSyncMeta(board, null);
    return {
      jobs: merged.sort((a, b) => (a.projectNumber ?? a.text ?? "").localeCompare(b.projectNumber ?? b.text ?? "", "nl")),
      assignments,
      status: buildPlanningGoogleStatus(board, {
        connection,
        lastSyncedAt: new Date(),
        lastError: null,
      }),
    };
  } catch (error) {
    console.error("[planning-google]", error);
    lastError = error instanceof Error ? error.message : "Google Agenda sync mislukt.";
    await recordPlanningGoogleSyncMeta(board, lastError);
    const meta = await prismadb.crm_PlanningGoogleSyncMeta.findUnique({
      where: { board: boardEnum(board) },
    });
    return {
      jobs,
      assignments,
      status: buildPlanningGoogleStatus(board, {
        connection,
        lastSyncedAt: meta?.last_synced_at ?? null,
        lastError,
      }),
    };
  }
}

export async function recordPlanningGoogleSyncMeta(board: PlanningBoardId, error: string | null) {
  await prismadb.crm_PlanningGoogleSyncMeta.upsert({
    where: { board: boardEnum(board) },
    create: {
      board: boardEnum(board),
      last_synced_at: error ? undefined : new Date(),
      last_error: error,
    },
    update: {
      last_synced_at: error ? undefined : new Date(),
      last_error: error,
      updatedAt: new Date(),
    },
  });
}

export async function syncBoardJobsToGoogle(
  board: PlanningBoardId,
  jobs: PlanningJobView[],
  assignments: PlanningAssignmentView[],
): Promise<void> {
  for (const job of jobs) {
    if (job.board !== board && job.kind !== "manual") continue;
    const targetBoard =
      job.kind === "chassis"
        ? boardForChassis()
        : job.kind === "glass"
          ? boardForGlass()
          : job.kind === "office"
            ? "binnendienst"
            : job.board;
    if (targetBoard !== board) continue;
    try {
      await pushPlanningJobToGoogle(board, job, assignments);
    } catch (error) {
      console.error("[planning-google] push", job.id, error);
      throw error;
    }
  }
  await recordPlanningGoogleSyncMeta(board, null);
}

export { boardFromEnum };