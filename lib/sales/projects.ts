import { Prisma } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import type { AuthzUser } from "@/lib/authz/session";
import { opportunityReadScopeWhere } from "@/lib/authz/scopes/crm";
import { SalesError } from "./errors";
import { formatProjectNumber, projectCreationAllowed } from "./project-number";

type RawClient = { $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T> };

/** Atomic yearly counter. The first project of a year gets sequence 1. */
export async function allocateProjectNumber(tx: RawClient, now: Date = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const rows = await tx.$queryRaw<{ counter: number }[]>(Prisma.sql`
    UPDATE "NumberSeries"
    SET "counter" = CASE WHEN "resetPolicy" = 'YEARLY' AND "currentYear" IS DISTINCT FROM ${year} THEN 1 ELSE "counter" + 1 END,
        "currentYear" = ${year},
        "updatedAt" = now()
    WHERE "id" = (
      SELECT "id" FROM "NumberSeries" WHERE "scope" = 'project' AND "isDefault" AND "active" ORDER BY "createdAt" LIMIT 1
    )
    RETURNING "counter"`);
  const row = rows[0];
  if (!row) throw new SalesError("noSeries");
  return formatProjectNumber(Number(row.counter), year);
}

function denyPartner(user: AuthzUser) {
  if (user.role === "partner") throw new SalesError("forbidden");
}

export type ProjectListRow = {
  id: string;
  projectNumber: string;
  dossierNumber: string | null;
  name: string | null;
  customer: string | null;
  seller: string | null;
  projectGroup: string | null;
  createdAt: string | null;
};

export async function listProjects(user: AuthzUser): Promise<ProjectListRow[]> {
  denyPartner(user);
  const rows = await prismadb.crm_Opportunities.findMany({
    where: {
      is_dossier: true,
      execution_project_number: { not: null },
      ...opportunityReadScopeWhere(user),
    },
    select: {
      id: true,
      execution_project_number: true,
      dossier_number: true,
      name: true,
      seller_name: true,
      project_group: true,
      project_created_at: true,
      assigned_account: { select: { name: true } },
      assigned_to_user: { select: { name: true } },
    },
    orderBy: [{ project_created_at: "desc" }, { createdAt: "desc" }],
  });
  return rows.flatMap((row) => {
    if (!row.execution_project_number) return [];
    return [{
      id: row.id,
      projectNumber: row.execution_project_number,
      dossierNumber: row.dossier_number,
      name: row.name,
      customer: row.assigned_account?.name ?? null,
      seller: row.seller_name ?? row.assigned_to_user?.name ?? null,
      projectGroup: row.project_group,
      createdAt: row.project_created_at?.toISOString() ?? null,
    }];
  });
}

export type ProjectDashboard = {
  projectCount: number;
  newThisMonth: number;
  wonWithoutProjectCount: number;
  wonWithoutProject: { id: string; number: string | null; name: string | null; customer: string | null }[];
  recent: { id: string; projectNumber: string; name: string | null; customer: string | null }[];
};

export async function getProjectDashboard(user: AuthzUser, now = new Date()): Promise<ProjectDashboard> {
  denyPartner(user);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const waitingWhere = {
    is_dossier: true,
    dossier_status: "GEWONNEN" as const,
    execution_project_number: null,
    ...opportunityReadScopeWhere(user),
  };
  const [projects, waitingCount, waiting] = await Promise.all([
    listProjects(user),
    prismadb.crm_Opportunities.count({ where: waitingWhere }),
    prismadb.crm_Opportunities.findMany({
      where: waitingWhere,
      select: {
        id: true,
        dossier_number: true,
        name: true,
        assigned_account: { select: { name: true } },
      },
      orderBy: [{ won_at: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
  ]);
  return {
    projectCount: projects.length,
    newThisMonth: projects.filter((row) => row.createdAt != null && row.createdAt >= monthStart.toISOString()).length,
    wonWithoutProjectCount: waitingCount,
    wonWithoutProject: waiting.map((row) => ({
      id: row.id,
      number: row.dossier_number,
      name: row.name,
      customer: row.assigned_account?.name ?? null,
    })),
    recent: projects.slice(0, 8).map((row) => ({
      id: row.id,
      projectNumber: row.projectNumber,
      name: row.name,
      customer: row.customer,
    })),
  };
}

type LockedDossier = {
  id: string;
  dossier_status: string | null;
  execution_project_number: string | null;
};

/**
 * Gives a won dossier its project number. Prices, seller and the other dossier fields stay as they are.
 * A second call returns the number that was already given.
 */
export async function createProjectFromWonDossier(
  user: AuthzUser,
  dossierId: string,
): Promise<{ id: string; number: string; created: boolean }> {
  denyPartner(user);
  const result = await prismadb.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<LockedDossier[]>(Prisma.sql`
      SELECT "id", "dossier_status", "execution_project_number"
      FROM "crm_Opportunities"
      WHERE "id" = ${dossierId}::uuid AND "is_dossier" = true AND "deletedAt" IS NULL
      FOR UPDATE
    `);
    const dossier = locked[0];
    if (!dossier) throw new SalesError("notFound");
    if (!projectCreationAllowed(dossier.dossier_status)) throw new SalesError("projectNotWon");
    if (dossier.execution_project_number) {
      return { id: dossier.id, number: dossier.execution_project_number, created: false };
    }
    const number = await allocateProjectNumber(tx);
    await tx.crm_Opportunities.update({
      where: { id: dossier.id },
      data: {
        execution_project_number: number,
        project_created_at: new Date(),
        updatedBy: user.id,
      },
    });
    return { id: dossier.id, number, created: true };
  });
  if (result.created) {
    await writeAuditLog({
      entityType: "opportunity",
      entityId: result.id,
      action: "updated",
      changes: [{ field: "execution_project_number", old: null, new: result.number }],
      userId: user.id,
    });
  }
  return result;
}
