import { prismadb } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import type { AuthzUser } from "@/lib/authz/session";
import { AuthorizationError } from "@/lib/authz/errors";
import { assertCanWriteOpportunity, opportunityReadScopeWhere } from "@/lib/authz/scopes/crm";
import { SalesError } from "./errors";
import {
  dossierInProjectbox,
  parseProjectLeader,
  projectLeaderNameForUser,
  type ProjectLeaderName,
  type ProjectboxRow,
} from "./projectbox";

function denyPartner(user: AuthzUser) {
  if (user.role === "partner") throw new SalesError("forbidden");
}

/** A projectleider sees every project. A verkoper stays on their own dossiers. */
function projectReadWhere(user: AuthzUser) {
  if (projectLeaderNameForUser(user)) return { deletedAt: null };
  return opportunityReadScopeWhere(user);
}

async function guardWrite(user: AuthzUser, dossierId: string) {
  try {
    await assertCanWriteOpportunity(user, dossierId);
  } catch (error) {
    if (error instanceof AuthorizationError) throw new SalesError("forbidden");
    throw error;
  }
}

export async function listProjectbox(user: AuthzUser): Promise<ProjectboxRow[]> {
  denyPartner(user);
  const rows = await prismadb.crm_Opportunities.findMany({
    where: {
      is_dossier: true,
      projectleiding_action: true,
      execution_project_number: { not: null },
      ...projectReadWhere(user),
    },
    select: {
      id: true,
      execution_project_number: true,
      dossier_number: true,
      name: true,
      seller_name: true,
      project_leader: true,
      assigned_account: { select: { name: true } },
      assigned_to_user: { select: { name: true } },
    },
    orderBy: [{ project_created_at: "desc" }, { dossier_number: "asc" }],
  });
  return rows.flatMap((row) => {
    if (!dossierInProjectbox(true, row.execution_project_number) || !row.execution_project_number) return [];
    let projectLeader: ProjectLeaderName | null = null;
    try {
      projectLeader = parseProjectLeader(row.project_leader);
    } catch {
      projectLeader = null;
    }
    return [{
      id: row.id,
      projectNumber: row.execution_project_number,
      dossierNumber: row.dossier_number,
      name: row.name,
      customer: row.assigned_account?.name ?? null,
      seller: row.seller_name ?? row.assigned_to_user?.name ?? null,
      projectLeader,
    }];
  });
}

/** Toggles the sales checkbox. Prices, seller and the project number stay as they are. */
export async function setProjectleidingAction(user: AuthzUser, dossierId: string, checked: boolean) {
  denyPartner(user);
  await guardWrite(user, dossierId);
  const row = await prismadb.crm_Opportunities.findFirst({
    where: { id: dossierId, is_dossier: true, deletedAt: null },
    select: { id: true, projectleiding_action: true },
  });
  if (!row) throw new SalesError("notFound");
  const next = checked ? true : null;
  if ((row.projectleiding_action === true) === (next === true)) return;
  await prismadb.crm_Opportunities.update({
    where: { id: dossierId },
    data: { projectleiding_action: next, updatedBy: user.id },
  });
  await writeAuditLog({
    entityType: "opportunity",
    entityId: dossierId,
    action: "updated",
    changes: [{ field: "projectleiding_action", old: row.projectleiding_action, new: next }],
    userId: user.id,
  });
}

/**
 * Stores the chosen name on the project. A name can be set only while the dossier is in Projectbox.
 * Clearing the name is allowed on a project so a trial assignment can be removed.
 */
export async function assignProjectLeader(user: AuthzUser, dossierId: string, leader: string | null) {
  denyPartner(user);
  if (!projectLeaderNameForUser(user)) await guardWrite(user, dossierId);
  let name: ProjectLeaderName | null;
  try {
    name = parseProjectLeader(leader);
  } catch {
    throw new SalesError("projectLeaderInvalid");
  }
  const row = await prismadb.crm_Opportunities.findFirst({
    where: { id: dossierId, is_dossier: true, deletedAt: null },
    select: {
      id: true,
      project_leader: true,
      projectleiding_action: true,
      execution_project_number: true,
    },
  });
  if (!row) throw new SalesError("notFound");
  if (name && !dossierInProjectbox(row.projectleiding_action, row.execution_project_number)) {
    throw new SalesError("projectLeaderNeedsBox");
  }
  if (!name && !row.execution_project_number) throw new SalesError("notFound");
  if ((row.project_leader ?? null) === name) return;
  await prismadb.crm_Opportunities.update({
    where: { id: dossierId },
    data: { project_leader: name, updatedBy: user.id },
  });
  await writeAuditLog({
    entityType: "opportunity",
    entityId: dossierId,
    action: "updated",
    changes: [{ field: "project_leader", old: row.project_leader, new: name }],
    userId: user.id,
  });
}
