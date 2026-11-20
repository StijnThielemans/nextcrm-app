import { randomUUID } from "crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { writeAuditLog } from "@/lib/audit-log";
import type { AuthzUser } from "@/lib/authz";
import { assertCanWriteOpportunity } from "@/lib/authz/scopes/crm";
import { newDocumentFile } from "@/lib/documents/new-document-file";
import { inngest } from "@/inngest/client";
import { MINIO_BUCKET, minioClient } from "@/lib/minio";
import { prismadb } from "@/lib/prisma";
import { SalesError } from "@/lib/sales/errors";
import { systemTypeForFiling } from "@/lib/sales/labels";
import { raamstudioArchive } from "./project-archive";
import {
  RAAMSTUDIO_DOCUMENT_DESCRIPTION,
  raamstudioDocumentName,
  type WorkspaceDraft,
} from "./workspace-model";
import { raamstudioPlansForDossier } from "./dossier-plans";

const RAAMSTUDIO_MIME = "application/zip";

export async function saveRaamstudioOnDossier(
  user: AuthzUser,
  dossierId: string,
  draft: WorkspaceDraft,
): Promise<{ id: string; fileName: string }> {
  await assertCanWriteOpportunity(user, dossierId);
  const dossier = await raamstudioPlansForDossier(user, dossierId);
  if (!dossier) throw new SalesError("notFound");
  if (dossier.locked) throw new SalesError("terminal");
  if (!MINIO_BUCKET) throw new Error("MINIO_BUCKET is not defined");

  const planNames = dossier.plans.filter((plan) => plan.kind === "plan").map((plan) => plan.name);
  const bytes = raamstudioArchive(
    {
      number: dossier.number,
      name: dossier.name,
      customer: dossier.customer,
      siteAddress: dossier.siteAddress,
      contact: dossier.contact,
      seller: dossier.seller,
      projectGroup: dossier.projectGroup,
    },
    draft,
    planNames,
  );
  const fileName = raamstudioDocumentName(dossier.number);
  const key = `documents/${randomUUID()}.tc-raam`;
  const stored = await newDocumentFile(key);
  await minioClient.send(
    new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: RAAMSTUDIO_MIME,
    }),
  );

  const existing = await prismadb.documents.findFirst({
    where: {
      deletedAt: null,
      document_name: fileName,
      description: RAAMSTUDIO_DOCUMENT_DESCRIPTION,
      opportunities: { some: { opportunity_id: dossierId } },
    },
    select: { id: true, key: true },
  });

  const id = existing
    ? await replaceProject(user, dossierId, existing, stored, bytes.length, fileName)
    : await createProject(user, dossierId, stored, bytes.length, fileName);

  if (existing?.key && existing.key !== key) {
    await minioClient.send(new DeleteObjectCommand({ Bucket: MINIO_BUCKET, Key: existing.key })).catch(() => undefined);
  }
  return { id, fileName };
}

async function createProject(
  user: AuthzUser,
  dossierId: string,
  stored: { key: string; document_file_url: string },
  size: number,
  fileName: string,
) {
  const doc = await prismadb.documents.create({
    data: {
      v: 0,
      document_name: fileName,
      description: RAAMSTUDIO_DOCUMENT_DESCRIPTION,
      ...stored,
      size,
      document_file_mimeType: RAAMSTUDIO_MIME,
      document_system_type: systemTypeForFiling("CALCULATIE"),
      filing_category: "CALCULATIE",
      processing_status: "PENDING",
      createdBy: user.id,
      assigned_user: user.id,
      opportunities: { create: { opportunity_id: dossierId } },
    },
    select: { id: true },
  });
  await notify(doc.id);
  await writeAuditLog({
    entityType: "opportunity",
    entityId: dossierId,
    action: "relation_added",
    changes: [{ field: "document", old: null, new: doc.id }],
    userId: user.id,
  });
  return doc.id;
}

async function replaceProject(
  user: AuthzUser,
  dossierId: string,
  existing: { id: string; key: string | null },
  stored: { key: string; document_file_url: string },
  size: number,
  fileName: string,
) {
  await prismadb.documents.update({
    where: { id: existing.id },
    data: {
      document_name: fileName,
      description: RAAMSTUDIO_DOCUMENT_DESCRIPTION,
      ...stored,
      size,
      document_file_mimeType: RAAMSTUDIO_MIME,
      filing_category: "CALCULATIE",
      document_system_type: systemTypeForFiling("CALCULATIE"),
    },
  });
  await notify(existing.id);
  await writeAuditLog({
    entityType: "opportunity",
    entityId: dossierId,
    action: "updated",
    changes: [{ field: "raamstudio_project", old: existing.id, new: existing.id }],
    userId: user.id,
  });
  return existing.id;
}

async function notify(documentId: string) {
  try {
    await inngest.send({ name: "document/uploaded", data: { documentId } });
  } catch (error) {
    console.error("[raamstudio] document enrich event failed", error);
  }
}
