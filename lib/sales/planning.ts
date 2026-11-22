import { dossierInProjectbox } from "./projectbox";

/** Week calendars under Planning. Glass has no split in the data, so it stays on buitendienst. */
export const PLANNING_BOARDS = ["binnendienst", "buitendienst", "dienst-na-verkoop"] as const;

export type PlanningBoardId = (typeof PLANNING_BOARDS)[number];

export type PlanningKind = "chassis" | "glass" | "office" | "manual";

export const BOARD_TITLE: Record<PlanningBoardId, string> = {
  binnendienst: "Planning binnendienst",
  buitendienst: "Planning buitendienst",
  "dienst-na-verkoop": "Planning Dienst Na Verkoop",
};

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const JOB_ID = /^(chassis|glass|office|manual):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const WEEKDAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"] as const;
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"] as const;

export function boardForChassis(): PlanningBoardId {
  return "buitendienst";
}

/** Nothing on the project says glass belongs on another calendar. */
export function boardForGlass(): PlanningBoardId {
  return "buitendienst";
}

export function isIsoDay(value: string): boolean {
  const match = ISO_DAY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function asDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function dateKey(value: Date | null | undefined): string | null {
  if (!value) return null;
  const iso = value.toISOString().slice(0, 10);
  return isIsoDay(iso) ? iso : null;
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function weekdayIndex(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Saturday and Sunday move to the next Monday. A weekday stays. */
export function firstWeekday(iso: string): string {
  const day = weekdayIndex(iso);
  if (day === 6) return addDays(iso, 2);
  if (day === 0) return addDays(iso, 1);
  return iso;
}

/**
 * Work-day span from the dropped day. Monday–Friday only.
 * Three days dropped on a Wednesday are Wednesday, Thursday and Friday.
 */
export function planSpan(dropDay: string, workDays: number): { start: string; end: string } {
  if (!isIsoDay(dropDay) || !Number.isInteger(workDays) || workDays < 1) {
    throw new Error("planningSpanInvalid");
  }
  let cursor = firstWeekday(dropDay);
  const start = cursor;
  for (let placed = 1; placed < workDays; placed += 1) {
    cursor = addDays(cursor, 1);
    const day = weekdayIndex(cursor);
    if (day === 6) cursor = addDays(cursor, 2);
    else if (day === 0) cursor = addDays(cursor, 1);
  }
  return { start, end: cursor };
}

export function spanDays(start: string, end: string): string[] {
  if (!isIsoDay(start) || !isIsoDay(end) || end < start) return [];
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end && days.length < 366) {
    const day = weekdayIndex(cursor);
    if (day !== 0 && day !== 6) days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function mondayOf(iso: string): string {
  const day = weekdayIndex(iso);
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(iso, delta);
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function weekFromParam(value: string | undefined, today = todayIso()): string {
  if (value && isIsoDay(value)) return mondayOf(value);
  return mondayOf(today);
}

export function formatDayParts(iso: string): { weekday: string; day: string; month: string; year: string } {
  const month = Number(iso.slice(5, 7));
  return {
    weekday: WEEKDAYS[weekdayIndex(iso)],
    day: String(Number(iso.slice(8, 10))),
    month: MONTHS[month - 1],
    year: iso.slice(0, 4),
  };
}

export function formatWeekTitle(monday: string): string {
  const sunday = addDays(monday, 6);
  const start = formatDayParts(monday);
  const end = formatDayParts(sunday);
  if (start.month === end.month && start.year === end.year) {
    return `${start.day}–${end.day} ${start.month} ${start.year}`;
  }
  if (start.year === end.year) {
    return `${start.day} ${start.month} – ${end.day} ${end.month} ${start.year}`;
  }
  return `${start.day} ${start.month} ${start.year} – ${end.day} ${end.month} ${end.year}`;
}

export function positiveWorkDays(value: number | null | undefined): number | null {
  if (value == null || !Number.isInteger(value) || value <= 0) return null;
  return value;
}

export function parseJobId(value: string): { kind: PlanningKind; id: string } | null {
  const match = JOB_ID.exec(value.trim());
  if (!match) return null;
  return { kind: match[1].toLowerCase() as PlanningKind, id: match[2].toLowerCase() };
}

export function jobId(kind: PlanningKind, id: string): string {
  return `${kind}:${id}`;
}

export type ProjectPlanningInput = {
  id: string;
  projectNumber: string;
  customer: string | null;
  address: string | null;
  projectleidingAction: boolean | null;
  chassisWorkDays: number | null;
  glassWorkDays: number | null;
  chassisStart: string | null;
  chassisEnd: string | null;
  glassStart: string | null;
  glassEnd: string | null;
  officeStart: string | null;
  officeEnd: string | null;
};

export type PlanningJobDraft = {
  id: string;
  kind: PlanningKind;
  board: PlanningBoardId;
  projectId: string | null;
  projectNumber: string | null;
  customer: string | null;
  address: string | null;
  text: string | null;
  workDays: number;
  start: string | null;
  end: string | null;
  days: string[];
};

function placed(start: string | null, end: string | null): { start: string; end: string; days: string[] } | null {
  if (!start || !end) return null;
  const days = spanDays(start, end);
  if (!days.length) return null;
  return { start: days[0], end: days[days.length - 1], days };
}

function draft(
  partial: Omit<PlanningJobDraft, "start" | "end" | "days"> & { start: string | null; end: string | null },
): PlanningJobDraft {
  const span = placed(partial.start, partial.end);
  return {
    ...partial,
    start: span?.start ?? null,
    end: span?.end ?? null,
    days: span?.days ?? [],
  };
}

/** Chassis and glass are separate jobs. A projectbox dossier without those days is one binnendienst card. */
export function jobsFromProject(row: ProjectPlanningInput): PlanningJobDraft[] {
  const jobs: PlanningJobDraft[] = [];
  const chassis = positiveWorkDays(row.chassisWorkDays);
  const glass = positiveWorkDays(row.glassWorkDays);
  if (chassis) {
    jobs.push(draft({
      id: jobId("chassis", row.id),
      kind: "chassis",
      board: boardForChassis(),
      projectId: row.id,
      projectNumber: row.projectNumber,
      customer: row.customer,
      address: row.address,
      text: null,
      workDays: chassis,
      start: row.chassisStart,
      end: row.chassisEnd,
    }));
  }
  if (glass) {
    jobs.push(draft({
      id: jobId("glass", row.id),
      kind: "glass",
      board: boardForGlass(),
      projectId: row.id,
      projectNumber: row.projectNumber,
      customer: row.customer,
      address: row.address,
      text: null,
      workDays: glass,
      start: row.glassStart,
      end: row.glassEnd,
    }));
  }
  if (!chassis && !glass && dossierInProjectbox(row.projectleidingAction, row.projectNumber)) {
    jobs.push(draft({
      id: jobId("office", row.id),
      kind: "office",
      board: "binnendienst",
      projectId: row.id,
      projectNumber: row.projectNumber,
      customer: row.customer,
      address: row.address,
      text: null,
      workDays: 1,
      start: row.officeStart,
      end: row.officeEnd,
    }));
  }
  return jobs;
}

export type WorkDaySpanUpdate = {
  chassisStart: string | null | undefined;
  chassisEnd: string | null | undefined;
  glassStart: string | null | undefined;
  glassEnd: string | null | undefined;
  clearOffice: boolean;
  chassisDays: "unchanged" | "clear" | string[];
  glassDays: "unchanged" | "clear" | string[];
};

/** Keeps a stored span in step with the work-day count. Empty days clear the span. */
export function workDaySpanUpdate(input: {
  chassis: number | null;
  glass: number | null;
  chassisStart: string | null;
  glassStart: string | null;
}): WorkDaySpanUpdate {
  const chassis = positiveWorkDays(input.chassis);
  const glass = positiveWorkDays(input.glass);
  const result: WorkDaySpanUpdate = {
    chassisStart: undefined,
    chassisEnd: undefined,
    glassStart: undefined,
    glassEnd: undefined,
    clearOffice: chassis != null || glass != null,
    chassisDays: "unchanged",
    glassDays: "unchanged",
  };
  if (!chassis) {
    result.chassisStart = null;
    result.chassisEnd = null;
    result.chassisDays = "clear";
  } else if (input.chassisStart && isIsoDay(input.chassisStart)) {
    const span = planSpan(input.chassisStart, chassis);
    result.chassisStart = span.start;
    result.chassisEnd = span.end;
    result.chassisDays = spanDays(span.start, span.end);
  }
  if (!glass) {
    result.glassStart = null;
    result.glassEnd = null;
    result.glassDays = "clear";
  } else if (input.glassStart && isIsoDay(input.glassStart)) {
    const span = planSpan(input.glassStart, glass);
    result.glassStart = span.start;
    result.glassEnd = span.end;
    result.glassDays = spanDays(span.start, span.end);
  }
  return result;
}

/** Fixed TILO palette. A job keeps one color; jobs that share a day do not share that color. */
export const PLANNING_PALETTE = [
  { id: "teal", background: "#d7f3f1", border: "#008080", color: "#083838" },
  { id: "clay", background: "#f8e6d6", border: "#b86a3d", color: "#4a2a14" },
  { id: "ink", background: "#dce7f6", border: "#3d6494", color: "#1c334d" },
  { id: "rose", background: "#f8dce4", border: "#a84b68", color: "#5a2436" },
  { id: "moss", background: "#e4f0d4", border: "#5e7d34", color: "#2c4014" },
  { id: "lilac", background: "#e8e0f6", border: "#6d56a0", color: "#322456" },
  { id: "sand", background: "#f8efc4", border: "#9a7b16", color: "#4a3c08" },
  { id: "stone", background: "#e7eaed", border: "#5c6b78", color: "#243038" },
] as const;

export type PlanningColor = (typeof PLANNING_PALETTE)[number];

function hashKey(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function assignJobColors(jobs: readonly { id: string; days: readonly string[] }[]): Map<string, PlanningColor> {
  const sorted = [...jobs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const chosen = new Map<string, number>();
  const daySets = new Map(sorted.map((job) => [job.id, new Set(job.days)]));
  for (const job of sorted) {
    const preferred = hashKey(job.id) % PLANNING_PALETTE.length;
    let pick = preferred;
    for (let step = 0; step < PLANNING_PALETTE.length; step += 1) {
      const candidate = (preferred + step) % PLANNING_PALETTE.length;
      const clash = [...chosen.entries()].some(([otherId, color]) => {
        if (color !== candidate) return false;
        const otherDays = daySets.get(otherId);
        const mine = daySets.get(job.id);
        if (!otherDays || !mine || mine.size === 0 || otherDays.size === 0) return false;
        for (const day of mine) if (otherDays.has(day)) return true;
        return false;
      });
      if (!clash) {
        pick = candidate;
        break;
      }
    }
    chosen.set(job.id, pick);
  }
  return new Map([...chosen.entries()].map(([id, index]) => [id, PLANNING_PALETTE[index]]));
}

export const PLANNING_CREW = [
  { id: "albert-einstein", name: "Albert Einstein", image: "/planning/albert-einstein.jpg", kind: "person" },
  { id: "marie-curie", name: "Marie Curie", image: "/planning/marie-curie.jpg", kind: "person" },
  { id: "nelson-mandela", name: "Nelson Mandela", image: "/planning/nelson-mandela.jpg", kind: "person" },
  { id: "frida-kahlo", name: "Frida Kahlo", image: "/planning/frida-kahlo.jpg", kind: "person" },
  { id: "leonardo-da-vinci", name: "Leonardo da Vinci", image: "/planning/leonardo-da-vinci.jpg", kind: "person" },
  { id: "amelia-earhart", name: "Amelia Earhart", image: "/planning/amelia-earhart.jpg", kind: "person" },
  { id: "charlie-chaplin", name: "Charlie Chaplin", image: "/planning/charlie-chaplin.jpg", kind: "person" },
  { id: "audrey-hepburn", name: "Audrey Hepburn", image: "/planning/audrey-hepburn.jpg", kind: "person" },
  { id: "david-bowie", name: "David Bowie", image: "/planning/david-bowie.jpg", kind: "person" },
  { id: "serena-williams", name: "Serena Williams", image: "/planning/serena-williams.jpg", kind: "person" },
  { id: "bruce-lee", name: "Bruce Lee", image: "/planning/bruce-lee.jpg", kind: "person" },
  { id: "ada-lovelace", name: "Ada Lovelace", image: "/planning/ada-lovelace.jpg", kind: "person" },
  { id: "vrachtwagen-1", name: "Vrachtwagen 1", image: "/planning/vrachtwagen-1.svg", kind: "truck" },
  { id: "vrachtwagen-2", name: "Vrachtwagen 2", image: "/planning/vrachtwagen-2.svg", kind: "truck" },
] as const;

export type PlanningCrewId = (typeof PLANNING_CREW)[number]["id"];

export function planningCrewById(id: string) {
  return PLANNING_CREW.find((person) => person.id === id) ?? null;
}

export type PlanningJobView = PlanningJobDraft & { color: PlanningColor };

export type PlanningAssignmentView = {
  id: string;
  resource: string;
  day: string;
  jobId: string;
};

export type PlanningBoardView = {
  board: PlanningBoardId;
  weekStart: string;
  today: string;
  days: string[];
  jobs: PlanningJobView[];
  assignments: PlanningAssignmentView[];
};

export type PlanningLinkHit = {
  kind: "project" | "quote";
  id: string;
  title: string;
  subtitle: string | null;
};
