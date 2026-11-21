import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { writeAuditLog } from "@/lib/audit-log";
import type { AuthzUser } from "@/lib/authz";
import { assertCanWriteOpportunity } from "@/lib/authz/scopes/crm";
import { newDocumentFile } from "@/lib/documents/new-document-file";
import { inngest } from "@/inngest/client";
import { MINIO_BUCKET, minioClient } from "@/lib/minio";
import { prismadb } from "@/lib/prisma";
import { SalesError } from "@/lib/sales/errors";
import { systemTypeForFiling } from "@/lib/sales/labels";
import { raamstudioPlansForDossier } from "./dossier-plans";
import { RAAMSTUDIO_EXPORT_DESCRIPTION, raamstudioExportName } from "./workspace-model";

const PDF_MIME = "application/pdf";
const MAX_BYTES = 12_000_000;

/** Store the previewed PDF on the open dossier. The project file, seller and amounts stay. */
export async function saveRaamstudioExportPdf(
  user: AuthzUser,
  dossierId: string,
  pdfBase64: string,
): Promise<{ id: string; fileName: string }> {
  await assertCanWriteOpportunity(user, dossierId);
  const dossier = await raamstudioPlansForDossier(user, dossierId);
  if (!dossier) throw new SalesError("notFound");
  if (dossier.locked) throw new SalesError("terminal");
  if (!MINIO_BUCKET) throw new Error("MINIO_BUCKET is not defined");

  const bytes = Buffer.from(pdfBase64, "base64");
  if (bytes.length < 8 || bytes.length > MAX_BYTES || bytes.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new Error("invalid pdf");
  }
  const fileName = raamstudioExportName(dossier.number);
  const key = `documents/${randomUUID()}.pdf`;
  const stored = await newDocumentFile(key);
  await minioClient.send(
    new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: PDF_MIME,
    }),
  );
  const doc = await prismadb.documents.create({
    data: {
      v: 0,
      document_name: fileName,
      description: RAAMSTUDIO_EXPORT_DESCRIPTION,
      ...stored,
      size: bytes.length,
      document_file_mimeType: PDF_MIME,
      document_system_type: systemTypeForFiling("CALCULATIE"),
      filing_category: "CALCULATIE",
      processing_status: "PENDING",
      createdBy: user.id,
      assigned_user: user.id,
      opportunities: { create: { opportunity_id: dossierId } },
    },
    select: { id: true },
  });
  try {
    await inngest.send({ name: "document/uploaded", data: { documentId: doc.id } });
  } catch (error) {
    console.error("[raamstudio] export enrich event failed", error);
  }
  await writeAuditLog({
    entityType: "opportunity",
    entityId: dossierId,
    action: "relation_added",
    changes: [{ field: "document", old: null, new: doc.id }],
    userId: user.id,
  });
  return { id: doc.id, fileName };
}
