import { randomUUID } from "crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prismadb } from "@/lib/prisma";
import type { AuthzUser } from "@/lib/authz/session";
import { AuthorizationError } from "@/lib/authz/errors";
import { assertCanWriteOpportunity } from "@/lib/authz/scopes/crm";
import { writeAuditLog } from "@/lib/audit-log";
import { newDocumentFile } from "@/lib/documents/new-document-file";
import { inngest } from "@/inngest/client";
import { MINIO_BUCKET, minioClient } from "@/lib/minio";
import { uploadExtension } from "@/lib/upload-content-types";
import { dossierIsReadOnly } from "./dossier-lock";
import { SalesError } from "./errors";
import {
  DOSSIER_DOCUMENT_CATEGORIES,
  systemTypeForFiling,
  type DossierDocumentCategory,
} from "./labels";
import { imageContentType, isOfferteboxStorageKey, safeFileName } from "./offertebox-mail";

const MAX_FILING_BATCH = 20;
const MAX_COPY_BYTES = 25 * 1024 * 1024;
const ATTACHMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PendingOfferteboxAttachment = {
  id: string;
  fileName: string;
};

export type FilingAssignment = {
  attachmentId: string;
  category: DossierDocumentCategory;
};

function denyPartner(user: AuthzUser) {
  if (user.role === "partner") throw new SalesError("forbidden");
}

function declaredMime(value: string): string {
  const mime = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime) ? mime : "application/octet-stream";
}

function extensionFromName(fileName: string): string | null {
  const match = /\.([a-z0-9]{1,8})$/i.exec(safeFileName(fileName));
  if (!match) return null;
  const extension = match[1].toLowerCase();
  if (extension === "html" || extension === "htm" || extension === "svg" || extension === "js" || extension === "exe") {
    return null;
  }
  return extension;
}

/** Mime and storage extension for a copy. The bytes decide for images and PDFs. */
export function documentMimeForAttachment(fileName: string, contentType: string, bytes: Buffer): { mimeType: string; extension: string } {
  const image = imageContentType(bytes);
  const pdf = bytes.length >= 4 && bytes.subarray(0, 4).toString("latin1") === "%PDF";
  const declared = declaredMime(contentType);
  const namedPdf = declared === "application/octet-stream" && fileName.toLowerCase().endsWith(".pdf");
  const mimeType = image ?? (pdf || namedPdf ? "application/pdf" : declared);
  const extension = uploadExtension(mimeType) ?? extensionFromName(fileName) ?? "bin";
  return { mimeType, extension };
}

export function documentCopyKey(extension: string): string {
  const safe = /^[a-z0-9]{1,8}$/.test(extension) ? extension : "bin";
  return `documents/${randomUUID()}.${safe}`;
}

export function offerteboxAttachmentIdFromTags(tags: unknown): string | null {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return null;
  const value = (tags as { offerteboxAttachmentId?: unknown }).offerteboxAttachmentId;
  return typeof value === "string" && ATTACHMENT_ID.test(value) ? value : null;
}

export function filedAttachmentKey(dossierId: string, attachmentId: string): string {
  return `${dossierId}:${attachmentId}`;
}

/** Which aanvraag files already have a live copy on the dossier. */
export function collectFiledAttachmentKeys(documents: { tags: unknown; dossierIds: string[] }[]): Set<string> {
  const keys = new Set<string>();
  for (const document of documents) {
    const attachmentId = offerteboxAttachmentIdFromTags(document.tags);
    if (!attachmentId) continue;
    for (const dossierId of document.dossierIds) keys.add(filedAttachmentKey(dossierId, attachmentId));
  }
  return keys;
}

export function normalizeFilingAssignments(assignments: FilingAssignment[]): FilingAssignment[] {
  if (!Array.isArray(assignments) || assignments.length === 0 || assignments.length > MAX_FILING_BATCH) {
    throw new SalesError("categoryRequired");
  }
  const seen = new Set<string>();
  return assignments.map((item) => {
    const attachmentId = typeof item?.attachmentId === "string" ? item.attachmentId.trim() : "";
    const category = item?.category;
    if (!ATTACHMENT_ID.test(attachmentId)) throw new SalesError("notFound");
    if (seen.has(attachmentId)) throw new SalesError("notFound");
    seen.add(attachmentId);
    if (!(DOSSIER_DOCUMENT_CATEGORIES as readonly string[]).includes(category)) {
      throw new SalesError("categoryRequired");
    }
    return { attachmentId, category };
  });
}

async function filedKeysForDossiers(dossierIds: string[]): Promise<Set<string>> {
  if (dossierIds.length === 0) return new Set();
  const documents = await prismadb.documents.findMany({
    where: {
      deletedAt: null,
      opportunities: { some: { opportunity_id: { in: dossierIds } } },
    },
    select: {
      tags: true,
      opportunities: { select: { opportunity_id: true } },
    },
  });
  return collectFiledAttachmentKeys(
    documents.map((document) => ({
      tags: document.tags,
      dossierIds: document.opportunities.map((link) => link.opportunity_id),
    })),
  );
}

export async function loadFiledAttachmentKeys(dossierIds: string[]): Promise<Set<string>> {
  return filedKeysForDossiers(dossierIds);
}

export async function listPendingOfferteboxAttachments(user: AuthzUser, dossierId: string): Promise<PendingOfferteboxAttachment[]> {
  denyPartner(user);
  const items = await prismadb.crm_OfferteboxItems.findMany({
    where: { dossier_id: dossierId },
    select: {
      attachments: {
        where: { inline: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, file_name: true },
      },
    },
  });
  const attachments = items.flatMap((item) => item.attachments);
  if (attachments.length === 0) return [];
  const filed = await filedKeysForDossiers([dossierId]);
  return attachments
    .filter((attachment) => !filed.has(filedAttachmentKey(dossierId, attachment.id)))
    .map((attachment) => ({ id: attachment.id, fileName: attachment.file_name }));
}

async function readAttachment(storageKey: string): Promise<Buffer> {
  if (!isOfferteboxStorageKey(storageKey) || !MINIO_BUCKET) throw new SalesError("notFound");
  const object = await minioClient.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: storageKey }));
  if (!object.Body) throw new SalesError("notFound");
  const bytes = Buffer.from(await object.Body.transformToByteArray());
  if (bytes.length === 0 || bytes.length > MAX_COPY_BYTES) throw new SalesError("mailTooLarge");
  return bytes;
}

/**
 * Copies each chosen aanvraag file into Documentbeheer. The mail keeps its own object.
 * The caller picks the category. Nothing is filed without one.
 */
export async function fileOfferteboxAttachments(user: AuthzUser, dossierId: string, input: FilingAssignment[]) {
  denyPartner(user);
  const assignments = normalizeFilingAssignments(input);
  try {
    await assertCanWriteOpportunity(user, dossierId);
  } catch (error) {
    if (error instanceof AuthorizationError) throw new SalesError("forbidden");
    throw error;
  }
  const dossier = await prismadb.crm_Opportunities.findFirst({
    where: { id: dossierId, is_dossier: true, deletedAt: null },
    select: { id: true, dossier_status: true },
  });
  if (!dossier) throw new SalesError("notFound");
  if (dossierIsReadOnly(dossier.dossier_status)) throw new SalesError("terminal");

  const rows = await prismadb.crm_OfferteboxAttachments.findMany({
    where: {
      id: { in: assignments.map((item) => item.attachmentId) },
      inline: false,
      item: { dossier_id: dossierId },
    },
    select: { id: true, file_name: true, content_type: true, storage_key: true },
  });
  if (rows.length !== assignments.length) throw new SalesError("notFound");

  const filed = await filedKeysForDossiers([dossierId]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const pending = assignments.filter((item) => !filed.has(filedAttachmentKey(dossierId, item.attachmentId)));
  if (pending.length === 0) return { filed: 0 };

  const bucket = MINIO_BUCKET;
  if (!bucket) throw new Error("MINIO_BUCKET is not defined");
  const uploaded: { key: string; attachmentId: string; fileName: string; mimeType: string; size: number; category: DossierDocumentCategory }[] = [];
  let committed = false;
  try {
    for (const item of pending) {
      const row = byId.get(item.attachmentId);
      if (!row) throw new SalesError("notFound");
      const bytes = await readAttachment(row.storage_key);
      const stored = documentMimeForAttachment(row.file_name, row.content_type, bytes);
      const key = documentCopyKey(stored.extension);
      await minioClient.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: stored.mimeType,
          ContentLength: bytes.length,
        }),
      );
      uploaded.push({
        key,
        attachmentId: row.id,
        fileName: safeFileName(row.file_name),
        mimeType: stored.mimeType,
        size: bytes.length,
        category: item.category,
      });
    }

    const created = await prismadb.$transaction(async (tx) => {
      const documents = [];
      for (const file of uploaded) {
        const stored = await newDocumentFile(file.key);
        const document = await tx.documents.create({
          data: {
            v: 0,
            document_name: file.fileName,
            description: file.category,
            ...stored,
            size: file.size,
            document_file_mimeType: file.mimeType,
            document_system_type: systemTypeForFiling(file.category),
            filing_category: file.category,
            processing_status: "PENDING",
            createdBy: user.id,
            assigned_user: user.id,
            tags: { offerteboxAttachmentId: file.attachmentId },
            opportunities: { create: { opportunity_id: dossierId } },
          },
          select: { id: true },
        });
        documents.push({ id: document.id, attachmentId: file.attachmentId });
      }
      return documents;
    });
    committed = true;

    for (const document of created) {
      try {
        await inngest.send({ name: "document/uploaded", data: { documentId: document.id } });
      } catch (error) {
        console.error("[sales] document enrich event failed", error);
      }
      await writeAuditLog({
        entityType: "opportunity",
        entityId: dossierId,
        action: "relation_added",
        changes: [{ field: "document", old: null, new: document.id }],
        userId: user.id,
      });
    }
    return { filed: created.length };
  } catch (error) {
    if (!committed) {
      await Promise.all(
        uploaded.map((file) =>
          minioClient.send(new DeleteObjectCommand({ Bucket: bucket, Key: file.key })).catch(() => undefined),
        ),
      );
    }
    throw error;
  }
}
