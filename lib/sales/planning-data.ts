import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import type { AuthzUser } from "@/lib/authz/session";
import { AuthorizationError } from "@/lib/authz/errors";
import { assertCanWriteOpportunity, opportunityReadScopeWhere } from "@/lib/authz/scopes/crm";
import { SalesError } from "./errors";
import {
  PLANNING_BOARDS,
  asDate,
  assignJobColors,
  boardForChassis,
  boardForGlass,
  dateKey,
  jobId,
  jobsFromProject,
  parseJobId,
  planSpan,
  planningCrewById,
  positiveWorkDays,
  spanDays,
  todayIso,
  weekDays,
  weekFromParam,
  type PlanningAssignmentView,
  type PlanningBoardId,
  type PlanningBoardView,
  type PlanningJobDraft,
  type PlanningJobView,
  type PlanningKind,
  type PlanningLinkHit,
  type WorkDaySpanUpdate,
} from "./planning";
import { dossierInProjectbox, projectLeaderNameForUser } from "./projectbox";

const KIND_TO_ENUM = {
  chassis: "CHASSIS",
  glass: "GLASS",
  office: "OFFICE",
  manual: "MANUAL",
} as const;

const ENUM_TO_KIND: Record<(typeof KIND_TO_ENUM)[PlanningKind], PlanningKind> = {
  CHASSIS: "chassis",
  GLASS: "glass",
  OFFICE: "office",
  MANUAL: "manual",
};

const TEXT_MAX = 500;

type AddressRow = {
  project_street: string | null;
  project_postal_code: string | null;
  project_city: string | null;
  project_country: string | null;
};

function siteAddress(row: AddressRow | null | undefined): string | null {
  if (!row) return null;
  const text = [row.project_street, row.project_postal_code, row.project_city, row.project_country]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(", ");
  return text || null;
}

function denyPartner(user: AuthzUser) {
  if (user.role === "partner") throw new SalesError("forbidden");
}

function visibleWhere(user: AuthzUser) {
  if (projectLeaderNameForUser(user)) return { deletedAt: null };
  return opportunityReadScopeWhere(user);
}

async function guardProjectWrite(user: AuthzUser, projectId: string) {
  try {
    await assertCanWriteOpportunity(user, projectId);
  } catch (error) {
    if (error instanceof AuthorizationError) throw new SalesError("forbidden");
    throw error;
  }
}

async function canWriteProject(user: AuthzUser, projectId: string) {
  if (!projectLeaderNameForUser(user)) await guardProjectWrite(user, projectId);
}

function paint(jobs: PlanningJobDraft[]): PlanningJobView[] {
  const colors = assignJobColors(jobs.map((job) => ({ id: job.id, days: job.days })));
  return jobs
    .map((job) => ({ ...job, color: colors.get(job.id) ?? assignJobColors([job]).get(job.id)! }))
    .sort((a, b) => (a.projectNumber ?? a.text ?? "").localeCompare(b.projectNumber ?? b.text ?? "", "nl") || a.kind.localeCompare(b.kind));
}

const projectSelect = {
  id: true,
  execution_project_number: true,
  projectleiding_action: true,
  chassis_work_days: true,
  glass_work_days: true,
  chassis_plan_start: true,
  chassis_plan_end: true,
  glass_plan_start: true,
  glass_plan_end: true,
  office_plan_start: true,
  office_plan_end: true,
  project_street: true,
  project_postal_code: true,
  project_city: true,
  project_country: true,
  assigned_account: { select: { name: true } },
} satisfies Prisma.crm_OpportunitiesSelect;

type ProjectRow = Prisma.crm_OpportunitiesGetPayload<{ select: typeof projectSelect }>;

function jobsOf(row: ProjectRow): PlanningJobDraft[] {
  if (!row.execution_project_number) return [];
  return jobsFromProject({
    id: row.id,
    projectNumber: row.execution_project_number,
    customer: row.assigned_account?.name ?? null,
    address: siteAddress(row),
    projectleidingAction: row.projectleiding_action,
    chassisWorkDays: row.chassis_work_days,
    glassWorkDays: row.glass_work_days,
    chassisStart: dateKey(row.chassis_plan_start),
    chassisEnd: dateKey(row.chassis_plan_end),
    glassStart: dateKey(row.glass_plan_start),
    glassEnd: dateKey(row.glass_plan_end),
    officeStart: dateKey(row.office_plan_start),
    officeEnd: dateKey(row.office_plan_end),
    place: row.project_city?.trim() || null,
  });
}

export async function loadPlanningBoard(
  user: AuthzUser,
  board: PlanningBoardId,
  weekParam: string | undefined,
  now = new Date(),
): Promise<PlanningBoardView> {
  denyPartner(user);
  if (!(PLANNING_BOARDS as readonly string[]).includes(board)) throw new SalesError("planningJob");
  const today = todayIso(now);
  const weekStart = weekFromParam(weekParam, today);
  const days = weekDays(weekStart);
  const scope = visibleWhere(user);
  const rows = await prismadb.crm_Opportunities.findMany({
    where: { is_dossier: true, execution_project_number: { not: null }, ...scope },
    select: projectSelect,
  });
  const jobs = rows.flatMap(jobsOf).filter((job) => job.board === board);
  if (board === "binnendienst") jobs.push(...(await manualJobs(user)));
  const painted = paint(jobs);
  const assignments = board === "buitendienst" ? await crewFor(painted, days) : [];
  return { board, weekStart, today, days, jobs: painted, assignments };
}

async function manualJobs(user: AuthzUser): Promise<PlanningJobDraft[]> {
  const scope = visibleWhere(user);
  const items = await prismadb.crm_PlanningItems.findMany({
    where: {
      board: "BINNENDIENST",
      deletedAt: null,
      AND: [
        { OR: [{ opportunity_id: null }, { opportunity: scope }] },
        { OR: [{ quote_id: null }, { quote: { deletedAt: null, family: { dossier: scope } } }] },
      ],
    },
    select: {
      id: true,
      text: true,
      plan_start: true,
      plan_end: true,
      opportunity: { select: projectSelect },
      quote: {
        select: {
          quote_number: true,
          family: { select: { dossier: { select: projectSelect } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return items.map((item) => {
    const dossier = item.opportunity ?? item.quote?.family.dossier ?? null;
    const projectNumber = dossier?.execution_project_number ?? null;
    const text = item.text.trim();
    const spanStart = dateKey(item.plan_start);
    const spanEnd = dateKey(item.plan_end);
    const days = spanStart && spanEnd ? spanDays(spanStart, spanEnd) : [];
    return {
      id: jobId("manual", item.id),
      kind: "manual" as const,
      board: "binnendienst" as const,
      projectId: projectNumber ? dossier?.id ?? null : null,
      projectNumber,
      customer: dossier?.assigned_account?.name ?? null,
      address: siteAddress(dossier),
      place: dossier?.project_city?.trim() || null,
      text: text || item.quote?.quote_number || projectNumber,
      workDays: 1,
      start: days[0] ?? null,
      end: days.at(-1) ?? null,
      days,
    };
  });
}

async function crewFor(jobs: PlanningJobView[], days: string[]): Promise<PlanningAssignmentView[]> {
  const projectIds = [...new Set(jobs.flatMap((job) => (job.projectId && (job.kind === "chassis" || job.kind === "glass") ? [job.projectId] : [])))];
  if (!projectIds.length) return [];
  const rows = await prismadb.crm_PlanningAssignments.findMany({
    where: {
      opportunity_id: { in: projectIds },
      kind: { in: ["CHASSIS", "GLASS"] },
      day: { in: days.map(asDate) },
    },
    select: { id: true, resource: true, day: true, kind: true, opportunity_id: true },
  });
  return rows.flatMap((row) => {
    const day = dateKey(row.day);
    const kind = ENUM_TO_KIND[row.kind];
    if (!day || !row.opportunity_id || (kind !== "chassis" && kind !== "glass")) return [];
    return [{ id: row.id, resource: row.resource, day, jobId: jobId(kind, row.opportunity_id) }];
  });
}

export async function searchPlanningLinks(user: AuthzUser, rawQuery: string): Promise<PlanningLinkHit[]> {
  denyPartner(user);
  const query = rawQuery.trim().slice(0, 80);
  const scope = visibleWhere(user);
  const projectMatch = query
    ? {
        OR: [
          { execution_project_number: { contains: query } },
          { dossier_number: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
          { assigned_account: { name: { contains: query, mode: "insensitive" as const } } },
        ],
      }
    : {};
  const quoteMatch = query
    ? {
        OR: [
          { quote_number: { contains: query, mode: "insensitive" as const } },
          { family: { dossier: { dossier_number: { contains: query, mode: "insensitive" as const } } } },
          { family: { dossier: { assigned_account: { name: { contains: query, mode: "insensitive" as const } } } } },
          { family: { dossier: { execution_project_number: { contains: query } } } },
        ],
      }
    : {};
  const [projects, quotes] = await Promise.all([
    prismadb.crm_Opportunities.findMany({
      where: { AND: [{ is_dossier: true, execution_project_number: { not: null }, ...scope }, projectMatch] },
      select: {
        id: true,
        execution_project_number: true,
        dossier_number: true,
        assigned_account: { select: { name: true } },
      },
      orderBy: [{ project_created_at: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prismadb.crm_ExternalQuotes.findMany({
      where: { AND: [{ deletedAt: null, family: { dossier: { is_dossier: true, ...scope } } }, quoteMatch] },
      select: {
        id: true,
        quote_number: true,
        family: {
          select: {
            dossier: {
              select: {
                dossier_number: true,
                assigned_account: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  const projectHits: PlanningLinkHit[] = projects.flatMap((row) => {
    if (!row.execution_project_number) return [];
    return [{
      kind: "project" as const,
      id: row.id,
      title: row.execution_project_number,
      subtitle: [row.assigned_account?.name, row.dossier_number].filter(Boolean).join(" · ") || null,
    }];
  });
  const quoteHits: PlanningLinkHit[] = quotes.map((row) => ({
    kind: "quote" as const,
    id: row.id,
    title: row.quote_number,
    subtitle: [row.family.dossier.assigned_account?.name, row.family.dossier.dossier_number].filter(Boolean).join(" · ") || null,
  }));
  return [...projectHits, ...quoteHits];
}

export async function createManualPlanningItem(
  user: AuthzUser,
  input: { text: string; projectId: string | null; quoteId: string | null },
) {
  denyPartner(user);
  const text = input.text.trim();
  if (text.length > TEXT_MAX) throw new SalesError("planningText");
  const projectId = input.projectId?.trim() || null;
  const quoteId = input.quoteId?.trim() || null;
  if (projectId && quoteId) throw new SalesError("planningOneLink");
  if (!text && !projectId && !quoteId) throw new SalesError("planningEmpty");
  if (projectId) {
    const row = await prismadb.crm_Opportunities.findFirst({
      where: { id: projectId, is_dossier: true, execution_project_number: { not: null }, ...visibleWhere(user) },
      select: { id: true },
    });
    if (!row) throw new SalesError("notFound");
  }
  if (quoteId) {
    const row = await prismadb.crm_ExternalQuotes.findFirst({
      where: { id: quoteId, deletedAt: null, family: { dossier: { is_dossier: true, ...visibleWhere(user) } } },
      select: { id: true },
    });
    if (!row) throw new SalesError("notFound");
  }
  await prismadb.crm_PlanningItems.create({
    data: {
      id: randomUUID(),
      board: "BINNENDIENST",
      text,
      opportunity_id: projectId,
      quote_id: quoteId,
      createdBy: user.id,
    },
  });
}

export async function deleteManualPlanningItem(user: AuthzUser, rawJobId: string) {
  denyPartner(user);
  const parsed = parseJobId(rawJobId);
  if (!parsed || parsed.kind !== "manual") throw new SalesError("planningJob");
  const item = await prismadb.crm_PlanningItems.findFirst({
    where: { id: parsed.id, deletedAt: null, board: "BINNENDIENST" },
    select: { id: true, opportunity_id: true, quote_id: true },
  });
  if (!item) throw new SalesError("notFound");
  if (item.opportunity_id) {
    const visible = await prismadb.crm_Opportunities.findFirst({
      where: { id: item.opportunity_id, ...visibleWhere(user) },
      select: { id: true },
    });
    if (!visible) throw new SalesError("forbidden");
  }
  await prismadb.crm_PlanningAssignments.deleteMany({ where: { item_id: item.id } });
  await prismadb.crm_PlanningItems.update({
    where: { id: item.id },
    data: { deletedAt: new Date(), updatedAt: new Date() },
  });
}

async function loadVisibleProject(user: AuthzUser, projectId: string) {
  const row = await prismadb.crm_Opportunities.findFirst({
    where: { id: projectId, is_dossier: true, execution_project_number: { not: null }, ...visibleWhere(user) },
    select: projectSelect,
  });
  if (!row) throw new SalesError("notFound");
  return row;
}

export async function placePlanningJob(
  user: AuthzUser,
  rawJobId: string,
  day: string | null,
): Promise<{ start: string | null }> {
  denyPartner(user);
  const parsed = parseJobId(rawJobId);
  if (!parsed) throw new SalesError("planningJob");
  if (day != null && !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new SalesError("planningDay");
  if (parsed.kind === "manual") return placeManual(user, parsed.id, day);
  const row = await loadVisibleProject(user, parsed.id);
  await canWriteProject(user, row.id);
  if (parsed.kind === "office") return placeOffice(user, row, day);
  if (parsed.kind !== "chassis" && parsed.kind !== "glass") throw new SalesError("planningJob");
  const workDays = positiveWorkDays(parsed.kind === "chassis" ? row.chassis_work_days : row.glass_work_days);
  if (!workDays) throw new SalesError("planningJob");
  const span = day ? planSpan(day, workDays) : null;
  if (parsed.kind === "chassis") {
    await prismadb.crm_Opportunities.update({
      where: { id: row.id },
      data: {
        chassis_plan_start: span ? asDate(span.start) : null,
        chassis_plan_end: span ? asDate(span.end) : null,
        updatedBy: user.id,
      },
    });
    await keepCrewDays(row.id, "CHASSIS", span ? spanDays(span.start, span.end) : null);
  } else {
    await prismadb.crm_Opportunities.update({
      where: { id: row.id },
      data: {
        glass_plan_start: span ? asDate(span.start) : null,
        glass_plan_end: span ? asDate(span.end) : null,
        updatedBy: user.id,
      },
    });
    await keepCrewDays(row.id, "GLASS", span ? spanDays(span.start, span.end) : null);
  }
  return { start: span?.start ?? null };
}

async function placeOffice(user: AuthzUser, row: ProjectRow, day: string | null) {
  const chassis = positiveWorkDays(row.chassis_work_days);
  const glass = positiveWorkDays(row.glass_work_days);
  if (chassis || glass || !row.execution_project_number || !dossierInProjectbox(row.projectleiding_action, row.execution_project_number)) {
    throw new SalesError("planningJob");
  }
  const span = day ? planSpan(day, 1) : null;
  await prismadb.crm_Opportunities.update({
    where: { id: row.id },
    data: {
      office_plan_start: span ? asDate(span.start) : null,
      office_plan_end: span ? asDate(span.end) : null,
      updatedBy: user.id,
    },
  });
  return { start: span?.start ?? null };
}

async function placeManual(user: AuthzUser, itemId: string, day: string | null) {
  const item = await prismadb.crm_PlanningItems.findFirst({
    where: { id: itemId, deletedAt: null, board: "BINNENDIENST" },
    select: { id: true, opportunity_id: true },
  });
  if (!item) throw new SalesError("notFound");
  if (item.opportunity_id) {
    const visible = await prismadb.crm_Opportunities.findFirst({
      where: { id: item.opportunity_id, ...visibleWhere(user) },
      select: { id: true },
    });
    if (!visible) throw new SalesError("forbidden");
  }
  const span = day ? planSpan(day, 1) : null;
  await prismadb.crm_PlanningItems.update({
    where: { id: item.id },
    data: {
      plan_start: span ? asDate(span.start) : null,
      plan_end: span ? asDate(span.end) : null,
    },
  });
  if (!span) await prismadb.crm_PlanningAssignments.deleteMany({ where: { item_id: item.id } });
  return { start: span?.start ?? null };
}

async function keepCrewDays(projectId: string, kind: "CHASSIS" | "GLASS", days: string[] | null) {
  if (!days) {
    await prismadb.crm_PlanningAssignments.deleteMany({ where: { opportunity_id: projectId, kind } });
    return;
  }
  await prismadb.crm_PlanningAssignments.deleteMany({
    where: {
      opportunity_id: projectId,
      kind,
      NOT: { day: { in: days.map(asDate) } },
    },
  });
}

export async function applyWorkDaySpanCrew(projectId: string, update: WorkDaySpanUpdate) {
  if (update.chassisDays === "clear") await keepCrewDays(projectId, "CHASSIS", null);
  else if (update.chassisDays !== "unchanged") await keepCrewDays(projectId, "CHASSIS", update.chassisDays);
  if (update.glassDays === "clear") await keepCrewDays(projectId, "GLASS", null);
  else if (update.glassDays !== "unchanged") await keepCrewDays(projectId, "GLASS", update.glassDays);
  if (update.clearOffice) {
    await prismadb.crm_PlanningAssignments.deleteMany({ where: { opportunity_id: projectId, kind: "OFFICE" } });
  }
}

export async function assignPlanningCrew(
  user: AuthzUser,
  input: { resource: string; jobId: string; day: string },
) {
  denyPartner(user);
  const person = planningCrewById(input.resource);
  if (!person) throw new SalesError("planningCrew");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) throw new SalesError("planningDay");
  const parsed = parseJobId(input.jobId);
  if (!parsed || (parsed.kind !== "chassis" && parsed.kind !== "glass")) throw new SalesError("planningCrew");
  const row = await loadVisibleProject(user, parsed.id);
  await canWriteProject(user, row.id);
  const workDays = positiveWorkDays(parsed.kind === "chassis" ? row.chassis_work_days : row.glass_work_days);
  const start = dateKey(parsed.kind === "chassis" ? row.chassis_plan_start : row.glass_plan_start);
  const end = dateKey(parsed.kind === "chassis" ? row.chassis_plan_end : row.glass_plan_end);
  if (!workDays || !start || !end || !spanDays(start, end).includes(input.day)) throw new SalesError("planningDay");
  const kind = KIND_TO_ENUM[parsed.kind];
  const board = parsed.kind === "chassis" ? boardForChassis() : boardForGlass();
  if (board !== "buitendienst") throw new SalesError("planningCrew");
  const existing = await prismadb.crm_PlanningAssignments.findFirst({
    where: {
      resource: person.id,
      day: asDate(input.day),
      kind,
      opportunity_id: row.id,
      item_id: null,
    },
    select: { id: true },
  });
  if (existing) return;
  await prismadb.crm_PlanningAssignments.create({
    data: {
      id: randomUUID(),
      resource: person.id,
      day: asDate(input.day),
      kind,
      opportunity_id: row.id,
      createdBy: user.id,
    },
  });
}

export async function removePlanningCrew(user: AuthzUser, assignmentId: string) {
  denyPartner(user);
  const row = await prismadb.crm_PlanningAssignments.findFirst({
    where: { id: assignmentId },
    select: { id: true, opportunity_id: true, kind: true },
  });
  if (!row?.opportunity_id || (row.kind !== "CHASSIS" && row.kind !== "GLASS")) throw new SalesError("notFound");
  await loadVisibleProject(user, row.opportunity_id);
  await canWriteProject(user, row.opportunity_id);
  await prismadb.crm_PlanningAssignments.delete({ where: { id: row.id } });
}
