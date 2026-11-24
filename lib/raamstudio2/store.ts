import { randomUUID } from "crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { writeAuditLog } from "@/lib/audit-log";
import type { AuthzUser } from "@/lib/authz";
import { assertCanWriteOpportunity } from "@/lib/authz/scopes/crm";
import { isDocumentKey, isUploadThingUrl, keyFromUrl } from "@/lib/documents/file-key";
import { newDocumentFile } from "@/lib/documents/new-document-file";
import { MINIO_BUCKET, MINIO_ENDPOINT, MINIO_PUBLIC_URL, minioClient } from "@/lib/minio";
import { prismadb } from "@/lib/prisma";
import { raamstudioPlansForDossier } from "@/lib/raamstudio/dossier-plans";
import { SalesError } from "@/lib/sales/errors";
import { systemTypeForFiling } from "@/lib/sales/labels";
import { RS2_DESCRIPTION, parseRs2, raamstudio2FileName, serializeRs2, type Rs2Project } from "./project";

const RS2_MIME = "application/vnd.thielemans.rs2+json";

export type Rs2Read =
  | { project: Rs2Project; fileName: string }
  | { project: null; fileName: null }
  | { error: string; fileName: string };

export async function readRaamstudio2(user: AuthzUser, dossierId: string): Promise<Rs2Read> {
  const dossier = await raamstudioPlansForDossier(user, dossierId);
  if (!dossier) return { project: null, fileName: null };
  const fileName = dossier.studio2?.name ?? raamstudio2FileName(dossier.number);
  if (!dossier.studio2) return { project: null, fileName: null };
  const stored = await prismadb.documents.findFirst({
    where: { id: dossier.studio2.id, deletedAt: null },
    select: { key: true, document_file_url: true, document_name: true },
  });
  if (!stored) return { error: "Het .rs2-bestand staat niet meer op het dossier.", fileName };
  try {
    const bytes = await documentBytes(stored);
    return { project: parseRs2(bytes.toString("utf8")), fileName: stored.document_name };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Het .rs2-bestand kon niet worden gelezen.", fileName };
  }
}

export async function saveRaamstudio2(user: AuthzUser, dossierId: string, project: Rs2Project): Promise<{ id: string; fileName: string }> {
  await assertCanWriteOpportunity(user, dossierId);
  const dossier = await raamstudioPlansForDossier(user, dossierId);
  if (!dossier) throw new SalesError("notFound");
  if (dossier.locked) throw new SalesError("terminal");
  if (!MINIO_BUCKET) throw new Error("MINIO_BUCKET is not defined");
  const checked = parseRs2(serializeRs2(project));
  const fileName = raamstudio2FileName(dossier.number);
  const bytes = Buffer.from(serializeRs2(checked), "utf8");
  const key = `documents/${randomUUID()}.rs2`;
  const stored = await newDocumentFile(key);
  await minioClient.send(
    new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: RS2_MIME,
    }),
  );

  const existing = await prismadb.documents.findFirst({
    where: {
      deletedAt: null,
      document_name: fileName,
      description: RS2_DESCRIPTION,
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
      description: RS2_DESCRIPTION,
      ...stored,
      size,
      document_file_mimeType: RS2_MIME,
      document_system_type: systemTypeForFiling("CALCULATIE"),
      filing_category: "CALCULATIE",
      processing_status: "PENDING",
      createdBy: user.id,
      assigned_user: user.id,
      opportunities: { create: { opportunity_id: dossierId } },
    },
    select: { id: true },
  });
  await writeAuditLog({
    entityType: "opportunity",
    entityId: dossierId,
    action: "relation_added",
    changes: [{ field: "raamstudio2", old: null, new: doc.id }],
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
      description: RS2_DESCRIPTION,
      ...stored,
      size,
      document_file_mimeType: RS2_MIME,
      filing_category: "CALCULATIE",
      document_system_type: systemTypeForFiling("CALCULATIE"),
    },
  });
  await writeAuditLog({
    entityType: "opportunity",
    entityId: dossierId,
    action: "updated",
    changes: [{ field: "raamstudio2", old: existing.id, new: existing.id }],
    userId: user.id,
  });
  return existing.id;
}

async function documentBytes(doc: { key: string | null; document_file_url: string; document_name: string }): Promise<Buffer> {
  if (isUploadThingUrl(doc.document_file_url)) {
    const response = await fetch(doc.document_file_url);
    if (!response.ok) throw new Error("Het .rs2-bestand kon niet worden gelezen.");
    return Buffer.from(await response.arrayBuffer());
  }
  const key = doc.key || keyFromUrl(doc.document_file_url, MINIO_BUCKET!, [MINIO_PUBLIC_URL, MINIO_ENDPOINT!]);
  if (!key || !isDocumentKey(key) || !MINIO_BUCKET) throw new Error("Het .rs2-bestand kon niet worden gelezen.");
  const object = await minioClient.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
  if (!object.Body) throw new Error("Het .rs2-bestand kon niet worden gelezen.");
  const chunks: Buffer[] = [];
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
