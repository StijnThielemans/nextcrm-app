import { prismadb } from "@/lib/prisma";
import type { AuthzUser } from "@/lib/authz/session";
import { AuthorizationError } from "@/lib/authz/errors";
import { assertCanWriteOpportunity } from "@/lib/authz/scopes/crm";
import { SalesError } from "./errors";
import { isSellerName, matchSellerUser } from "./aanvraag-fields";
import { currentDossierStep, type DashboardStep } from "./dossier-step";
import { isSameBrusselsWeek, OFFERTE_MAILBOX, staysUntilQuoteSent } from "./offertebox-weeks";

export type OfferteboxRow = {
  id: string;
  receivedAt: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  preview: string;
  sellerName: string | null;
  dossierId: string | null;
  dossierNumber: string | null;
  step: DashboardStep | null;
};

export type OfferteboxView = {
  mailboxLinked: boolean;
  sentThisWeek: number;
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
      sentAt: true,
      createdAt: true,
    },
  });
  for (const email of emails) {
    const receivedAt = email.sentAt ?? email.createdAt;
    const data = {
      from_name: email.fromName,
      from_email: email.fromEmail,
      subject: email.subject?.trim() || "(geen onderwerp)",
      preview: previewText(email.bodyText),
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

  let sentThisWeek = 0;
  const rows: OfferteboxRow[] = [];
  for (const item of items) {
    const dossier = item.dossier && !item.dossier.deletedAt ? item.dossier : null;
    const sends = dossier?.quote_sends ?? [];
    if (sends.some((send) => isSameBrusselsWeek(send.sent_at, now))) sentThisWeek += 1;
    if (!staysUntilQuoteSent(sends.length)) continue;
    rows.push({
      id: item.id,
      receivedAt: item.received_at.toISOString(),
      fromName: item.from_name?.trim() || "",
      fromEmail: item.from_email?.trim() || "",
      subject: item.subject,
      preview: item.preview?.trim() || "",
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
  return { mailboxLinked, sentThisWeek, rows };
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
