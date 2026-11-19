import { randomUUID } from "crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prismadb } from "@/lib/prisma";
import type { AuthzUser } from "@/lib/authz/session";
import { AuthorizationError } from "@/lib/authz/errors";
import { assertCanWriteOpportunity } from "@/lib/authz/scopes/crm";
import { MINIO_BUCKET, minioClient } from "@/lib/minio";
import { SalesError } from "./errors";
import { isSellerName, matchSellerUser } from "./aanvraag-fields";
import { currentDossierStep, type DashboardStep } from "./dossier-step";
import { OFFERTE_MAILBOX, staysUntilQuoteSent } from "./offertebox-weeks";
import { loadFiledAttachmentKeys, filedAttachmentKey } from "./offertebox-filing";
import { displayMailHtml, offerteboxStorageKey, parseOfferteboxMail, readableMailBody, sanitizeMailHtml } from "./offertebox-mail";

export type OfferteboxAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  isImage: boolean;
  filed: boolean;
};

export type OfferteboxRow = {
  id: string;
  receivedAt: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  preview: string;
  body: string;
  html: string;
  attachments: OfferteboxAttachment[];
  sellerName: string | null;
  dossierId: string | null;
  dossierNumber: string | null;
  step: DashboardStep | null;
};

export type OfferteboxView = {
  mailboxLinked: boolean;
  rows: OfferteboxRow[];
};

export type OfferteboxPrefill = {
  id: string;
  sellerName: string;
  subject: string;
  fromName: string;
  fromEmail: string;
};

function denyPartner(user: AuthzUser) {
  if (user.role === "partner") throw new SalesError("forbidden");
}

function previewText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
}

async function syncMailbox(): Promise<boolean> {
  const accounts = await prismadb.emailAccount.findMany({
    where: { isActive: true, username: { equals: OFFERTE_MAILBOX, mode: "insensitive" } },
    select: { id: true },
  });
  if (accounts.length === 0) return false;
  const emails = await prismadb.email.findMany({
    where: {
      emailAccountId: { in: accounts.map((account) => account.id) },
      folder: "INBOX",
      isDeleted: false,
    },
    select: {
      rfcMessageId: true,
      fromName: true,
      fromEmail: true,
      subject: true,
      bodyText: true,
      bodyHtml: true,
      sentAt: true,
      createdAt: true,
    },
  });
  for (const email of emails) {
    const receivedAt = email.sentAt ?? email.createdAt;
    const body = readableMailBody(email.bodyText, email.bodyHtml);
    const data = {
      from_name: email.fromName,
      from_email: email.fromEmail,
      subject: email.subject?.trim() || "(geen onderwerp)",
      preview: previewText(body),
      body_text: body || null,
      body_html: sanitizeMailHtml(email.bodyHtml) || null,
      received_at: receivedAt,
    };
    await prismadb.crm_OfferteboxItems.upsert({
      where: { message_key: email.rfcMessageId },
      create: { message_key: email.rfcMessageId, ...data },
      update: data,
    });
  }
  return true;
}

async function rememberEmailDossiers() {
  const dossiers = await prismadb.crm_Opportunities.findMany({
    where: { is_dossier: true, source_channel: "EMAIL_OFFERTE", deletedAt: null },
    select: {
      id: true,
      name: true,
      dossier_number: true,
      seller_name: true,
      request_date: true,
      createdAt: true,
      assigned_account: { select: { name: true, email: true } },
    },
  });
  for (const dossier of dossiers) {
    await prismadb.crm_OfferteboxItems.upsert({
      where: { message_key: `dossier:${dossier.id}` },
      create: {
        message_key: `dossier:${dossier.id}`,
        from_name: dossier.assigned_account?.name ?? null,
        from_email: dossier.assigned_account?.email ?? null,
        subject: dossier.name?.trim() || dossier.dossier_number || "Aanvraag",
        received_at: dossier.request_date ?? dossier.createdAt,
        seller_name: dossier.seller_name,
        dossier_id: dossier.id,
      },
      update: {},
    });
  }
}

export async function listOffertebox(user: AuthzUser, now = new Date()): Promise<OfferteboxView> {
  denyPartner(user);
  const mailboxLinked = await syncMailbox();
  await rememberEmailDossiers();
  const items = await prismadb.crm_OfferteboxItems.findMany({
    orderBy: { received_at: "desc" },
    include: {
      attachments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          file_name: true,
          content_type: true,
          size: true,
          is_image: true,
          content_id: true,
          inline: true,
        },
      },
      dossier: {
        select: {
          id: true,
          dossier_number: true,
          seller_name: true,
          dossier_status: true,
          deletedAt: true,
          documents: {
            where: { document: { deletedAt: null } },
            select: { document_id: true },
            take: 1,
          },
          quote_sends: { select: { sent_at: true } },
        },
      },
    },
  });

  const dossierIds: string[] = [];
  const seenDossiers = new Set<string>();
  for (const item of items) {
    const id = item.dossier && !item.dossier.deletedAt ? item.dossier.id : null;
    if (!id || seenDossiers.has(id)) continue;
    seenDossiers.add(id);
    dossierIds.push(id);
  }
  const filed = await loadFiledAttachmentKeys(dossierIds);
  const rows: OfferteboxRow[] = [];
  for (const item of items) {
    const dossier = item.dossier && !item.dossier.deletedAt ? item.dossier : null;
    const sends = dossier?.quote_sends ?? [];
    if (!staysUntilQuoteSent(sends.length)) continue;
    rows.push({
      id: item.id,
      receivedAt: item.received_at.toISOString(),
      fromName: item.from_name?.trim() || "",
      fromEmail: item.from_email?.trim() || "",
      subject: item.subject,
      preview: item.preview?.trim() || "",
      body: item.body_text?.trim() || item.preview?.trim() || "",
      html: displayMailHtml(
        item.body_html,
        item.attachments.map((attachment) => ({
          id: attachment.id,
          contentId: attachment.content_id,
          isImage: attachment.is_image,
        })),
      ),
      attachments: item.attachments.filter((attachment) => !attachment.inline).map((attachment) => ({
        id: attachment.id,
        fileName: attachment.file_name,
        contentType: attachment.content_type,
        size: attachment.size,
        isImage: attachment.is_image,
        filed: dossier ? filed.has(filedAttachmentKey(dossier.id, attachment.id)) : false,
      })),
      sellerName: dossier?.seller_name ?? item.seller_name,
      dossierId: dossier?.id ?? null,
      dossierNumber: dossier?.dossier_number ?? null,
      step: dossier
        ? currentDossierStep({
            hasDocuments: dossier.documents.length > 0,
            sentAt: null,
            status: dossier.dossier_status,
            now,
          })
        : null,
    });
  }
  return { mailboxLinked, rows };
}

/** A dropped .eml or Outlook .msg becomes a new row with no seller, so it lands on Verdelen. */
export async function importOfferteboxMail(user: AuthzUser, fileName: string, bytes: Buffer, contentType?: string) {
  denyPartner(user);
  const mail = await parseOfferteboxMail(fileName, bytes, contentType);
  const bucket = MINIO_BUCKET;
  if (!bucket) throw new Error("MINIO_BUCKET is not defined");

  const stored: string[] = [];
  try {
    const attachments = [];
    for (const attachment of mail.attachments) {
      const key = offerteboxStorageKey(randomUUID());
      await minioClient.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: attachment.bytes,
          ContentType: "application/octet-stream",
          ContentLength: attachment.bytes.length,
        }),
      );
      stored.push(key);
      attachments.push({
        file_name: attachment.fileName,
        content_type: attachment.contentType,
        size: attachment.bytes.length,
        storage_key: key,
        is_image: attachment.isImage,
        content_id: attachment.contentId || null,
        inline: attachment.inline,
      });
    }
    await prismadb.crm_OfferteboxItems.create({
      data: {
        message_key: `drop:${randomUUID()}`,
        from_name: mail.fromName || null,
        from_email: mail.fromEmail || null,
        subject: mail.subject,
        preview: previewText(mail.body),
        body_text: mail.body || null,
        body_html: mail.html || null,
        received_at: mail.receivedAt,
        seller_name: null,
        attachments: { create: attachments },
      },
    });
  } catch (error) {
    await Promise.all(
      stored.map((key) =>
        minioClient
          .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
          .catch(() => undefined),
      ),
    );
    throw error;
  }
}

export async function addOfferteboxRequest(
  user: AuthzUser,
  input: { fromName?: string; fromEmail?: string; subject?: string },
) {
  denyPartner(user);
  const fromName = (input.fromName ?? "").trim();
  const fromEmail = (input.fromEmail ?? "").trim();
  const subject = (input.subject ?? "").trim();
  if (!fromName && !fromEmail) throw new SalesError("nameRequired");
  if (fromEmail && !fromEmail.includes("@")) throw new SalesError("emailRequired");
  if (!subject || subject.length > 500) throw new SalesError("projectRequired");
  await prismadb.crm_OfferteboxItems.create({
    data: {
      message_key: `manual:${crypto.randomUUID()}`,
      from_name: fromName || null,
      from_email: fromEmail || null,
      subject,
      received_at: new Date(),
      seller_name: null,
    },
  });
}

export async function assignOfferteboxSeller(user: AuthzUser, id: string, sellerName: string) {
  denyPartner(user);
  if (!isSellerName(sellerName)) throw new SalesError("sellerRequired");
  const item = await prismadb.crm_OfferteboxItems.findUnique({
    where: { id },
    select: { id: true, dossier_id: true },
  });
  if (!item) throw new SalesError("notFound");
  const sellers = await prismadb.users.findMany({ select: { id: true, name: true } });
  const matched = matchSellerUser(sellers, sellerName);
  await prismadb.crm_OfferteboxItems.update({ where: { id }, data: { seller_name: sellerName } });
  if (!item.dossier_id) return;
  try {
    await assertCanWriteOpportunity(user, item.dossier_id);
  } catch (error) {
    if (error instanceof AuthorizationError) throw new SalesError("forbidden");
    throw error;
  }
  await prismadb.crm_Opportunities.update({
    where: { id: item.dossier_id },
    data: {
      seller_name: sellerName,
      ...(matched ? { assigned_to: matched.id } : {}),
      updatedBy: user.id,
    },
  });
}

export async function linkOfferteboxDossier(user: AuthzUser, itemId: string, dossierId: string) {
  denyPartner(user);
  const item = await prismadb.crm_OfferteboxItems.findUnique({
    where: { id: itemId },
    select: { id: true, dossier_id: true },
  });
  if (!item) throw new SalesError("notFound");
  if (item.dossier_id && item.dossier_id !== dossierId) throw new SalesError("notFound");
  const dossier = await prismadb.crm_Opportunities.findFirst({
    where: { id: dossierId, is_dossier: true, deletedAt: null },
    select: { id: true, seller_name: true },
  });
  if (!dossier) throw new SalesError("notFound");
  await prismadb.crm_OfferteboxItems.update({
    where: { id: itemId },
    data: { dossier_id: dossierId, seller_name: dossier.seller_name },
  });
}

export async function offerteboxPrefill(user: AuthzUser, id: string): Promise<OfferteboxPrefill | null> {
  denyPartner(user);
  const item = await prismadb.crm_OfferteboxItems.findUnique({
    where: { id },
    select: { id: true, seller_name: true, subject: true, from_name: true, from_email: true, dossier_id: true },
  });
  if (!item || item.dossier_id) return null;
  const email = item.from_email?.trim() ?? "";
  return {
    id: item.id,
    sellerName: item.seller_name ?? "",
    subject: item.subject,
    fromName: item.from_name?.trim() ?? "",
    fromEmail: email.toLowerCase() === OFFERTE_MAILBOX ? "" : email,
  };
}
