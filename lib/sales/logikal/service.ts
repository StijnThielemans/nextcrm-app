import { randomUUID } from "node:crypto";
import { prismadb } from "@/lib/prisma";
import type { AuthzUser } from "@/lib/authz/session";
import { AuthorizationError } from "@/lib/authz/errors";
import { assertCanWriteOpportunity } from "@/lib/authz/scopes/crm";
import { serializeDecimals, serializeDecimalsList } from "@/lib/serialize-decimals";
import { SalesError } from "../errors";
import { dossierIsReadOnly } from "../dossier-lock";
import { logikalGateway, type LogikalGatewayResult } from "./gateway";
import { runLockedCreate, type LinkSnapshot } from "./create-project";
import { parseLogikalExport } from "./parse-export";
import { matchLogikalExport } from "./match";
import { importLogikalPositions, type StoredPosition } from "./import-positions";
import { logikalDrawingStore } from "./drawings";

const MAX_ZIP = 30 * 1024 * 1024;

function denyPartner(user: AuthzUser) {
  if (user.role === "partner") throw new SalesError("forbidden");
}

async function loadWritable(user: AuthzUser, dossierId: string) {
  denyPartner(user);
  try {
    await assertCanWriteOpportunity(user, dossierId);
  } catch (error) {
    if (error instanceof AuthorizationError) throw new SalesError("forbidden");
    throw error;
  }
  const row = await prismadb.crm_Opportunities.findFirst({
    where: { id: dossierId, is_dossier: true, deletedAt: null },
    select: {
      id: true,
      dossier_status: true,
      dossier_number: true,
      name: true,
      logikal_project_id: true,
      logikal_project_name: true,
      logikal_link_state: true,
      logikal_create_token: true,
      logikal_create_started_at: true,
    },
  });
  if (!row) throw new SalesError("notFound");
  if (dossierIsReadOnly(row.dossier_status)) throw new SalesError("terminal");
  return row;
}

function snapshot(row: {
  logikal_project_id: string | null;
  logikal_project_name: string | null;
  logikal_link_state: string | null;
  logikal_create_token: string | null;
  logikal_create_started_at: Date | null;
  dossier_number: string | null;
  name: string | null;
}): LinkSnapshot {
  return {
    projectId: row.logikal_project_id,
    projectName: row.logikal_project_name,
    linkState: row.logikal_link_state,
    token: row.logikal_create_token,
    startedAt: row.logikal_create_started_at,
    dossierNumber: row.dossier_number,
    dossierName: row.name,
  };
}

export async function createLogikalProjectForDossier(
  user: AuthzUser,
  dossierId: string,
  gateway: (input: { dossierNumber: string | null; dossierName: string | null }) => Promise<LogikalGatewayResult> = logikalGateway,
) {
  const dossier = await loadWritable(user, dossierId);
  const outcome = await runLockedCreate({
    read: async () => snapshot(await loadWritable(user, dossier.id)),
    tryLock: async (token, now) => {
      const updated = await prismadb.crm_Opportunities.updateMany({
        where: {
          id: dossier.id,
          is_dossier: true,
          deletedAt: null,
          logikal_project_id: null,
          logikal_create_token: null,
          OR: [{ logikal_link_state: null }, { logikal_link_state: { not: "NEEDS_CHECK" } }],
        },
        data: { logikal_create_token: token, logikal_create_started_at: now },
      });
      return updated.count === 1;
    },
    saveLink: async (token, projectId, projectName) => {
      const updated = await prismadb.crm_Opportunities.updateMany({
        where: { id: dossier.id, logikal_create_token: token, logikal_project_id: null },
        data: {
          logikal_project_id: projectId,
          logikal_project_name: projectName,
          logikal_link_state: "LINKED",
          logikal_create_token: null,
          logikal_create_started_at: null,
        },
      });
      return updated.count === 1;
    },
    markNeedsCheck: async (token) => {
      await prismadb.crm_Opportunities.updateMany({
        where: { id: dossier.id, logikal_create_token: token, logikal_project_id: null },
        data: {
          logikal_link_state: "NEEDS_CHECK",
          logikal_create_token: null,
          logikal_create_started_at: null,
        },
      });
    },
    release: async (token) => {
      await prismadb.crm_Opportunities.updateMany({
        where: { id: dossier.id, logikal_create_token: token },
        data: { logikal_create_token: null, logikal_create_started_at: null },
      });
    },
    newToken: () => randomUUID(),
    gateway,
  });
  if (outcome.status === "not_configured") throw new SalesError("logikalNotConfigured");
  if (outcome.status === "needs_check") throw new SalesError("logikalNeedsCheck");
  if (outcome.status === "in_progress") throw new SalesError("logikalInProgress");
  if (outcome.status === "failed") throw new SalesError("logikalCreateFailed");
  return serializeDecimals({
    projectId: outcome.projectId,
    projectName: outcome.projectName,
    already: outcome.already,
  });
}

export type LogikalPreview = {
  projectName: string | null;
  reference: string | null;
  count: number;
  verdict: "match" | "mismatch" | "uncertain";
};

async function readUpload(file: File): Promise<Buffer> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".zip") || file.size <= 0 || file.size > MAX_ZIP) {
    throw new SalesError("logikalExportInvalid");
  }
  return Buffer.from(await file.arrayBuffer());
}

function verdictFor(dossier: { logikal_project_id: string | null; dossier_number: string | null; name: string | null }, parsed: ReturnType<typeof parseLogikalExport>) {
  return matchLogikalExport({
    linkedProjectId: dossier.logikal_project_id,
    dossierNumber: dossier.dossier_number,
    dossierName: dossier.name,
    exportName: parsed.projectName,
    exportOrderNo: parsed.orderNo,
    exportProjectKey: parsed.projectKey,
  });
}

export async function previewLogikalExport(user: AuthzUser, dossierId: string, file: File): Promise<LogikalPreview> {
  const dossier = await loadWritable(user, dossierId);
  const parsed = parseLogikalExport(await readUpload(file));
  return {
    projectName: parsed.projectName,
    reference: parsed.reference,
    count: parsed.positions.length,
    verdict: verdictFor(dossier, parsed),
  };
}

export async function confirmLogikalImport(user: AuthzUser, dossierId: string, file: File) {
  const dossier = await loadWritable(user, dossierId);
  const parsed = parseLogikalExport(await readUpload(file));
  const verdict = verdictFor(dossier, parsed);
  if (verdict === "mismatch") throw new SalesError("logikalProjectMismatch");
  const rows = await importLogikalPositions({
    listExisting: async () => {
      const existing = await prismadb.crm_LogikalPositions.findMany({
        where: { dossier_id: dossierId },
        select: { drawing_key: true },
      });
      return existing.map((row) => ({ drawingKey: row.drawing_key }));
    },
    put: (key, body, mime) => logikalDrawingStore.put(key, body, mime),
    remove: (key) => logikalDrawingStore.remove(key),
    replace: (next, importedAt) => prismadb.$transaction(async (tx) => {
      await tx.crm_LogikalPositions.deleteMany({ where: { dossier_id: dossierId } });
      if (next.length > 0) {
        await tx.crm_LogikalPositions.createMany({
          data: next.map((row) => ({
            id: row.id,
            dossier_id: dossierId,
            elevation_key: row.elevationKey,
            position_name: row.name,
            quantity: row.quantity,
            quote_text: row.quoteText,
            description: row.description,
            drawing_key: row.drawingKey,
            drawing_name: row.drawingName,
            drawing_mime: row.drawingMime,
            sort_order: row.sortOrder,
          })),
        });
      }
      await tx.crm_Opportunities.update({
        where: { id: dossierId },
        data: { logikal_imported_at: importedAt },
      });
    }),
  }, dossierId, parsed.positions);
  return serializeDecimalsList(rows.map(toClientPosition));
}

function toClientPosition(row: StoredPosition) {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    quoteText: row.quoteText,
    description: row.description,
    hasDrawing: row.drawingKey != null,
  };
}
