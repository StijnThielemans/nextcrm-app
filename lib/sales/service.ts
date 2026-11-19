import { Prisma } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import { allocateNumber } from "@/lib/orders/numbering";
import { OrderError } from "@/lib/orders/types";
import { writeAuditLog } from "@/lib/audit-log";
import { newDocumentFile } from "@/lib/documents/new-document-file";
import { inngest } from "@/inngest/client";
import type { AuthzUser } from "@/lib/authz/session";
import { AuthorizationError } from "@/lib/authz/errors";
import {
  accountReadScopeWhere,
  assertCanWriteAccount,
  assertCanWriteOpportunity,
  opportunityReadScopeWhere,
} from "@/lib/authz/scopes/crm";
import { SalesError } from "./errors";
import { quoteMargin } from "./margin";
import { salesTiles, type DashRow, type SalesTiles } from "./dashboard-math";
import { DOSSIER_STATUSES, DOSSIER_DOCUMENT_CATEGORIES, type DossierDocumentCategory, type DossierStatus, type RequestChannel, CHANNELS } from "./labels";
import { uploadExtension } from "@/lib/upload-content-types";
import { previewNumber } from "@/lib/orders/numbering";
import {
  isAccountRole,
  isProjectGroup,
  isSellerName,
  matchSellerUser,
  customerProjectLabel,
  type AccountRole,
  type ProjectGroup,
} from "./aanvraag-fields";

const TERMINAL = new Set(["GEWONNEN", "VERLOREN"]);

function denyPartner(user: AuthzUser) {
  if (user.role === "partner") throw new SalesError("forbidden");
}

async function guard(check: () => Promise<void>) {
  try {
    await check();
  } catch (e) {
    if (e instanceof AuthorizationError) throw new SalesError("forbidden");
    throw e;
  }
}

function day(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new SalesError("invalidDate");
  return new Date(`${iso}T00:00:00.000Z`);
}

function dayString(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function money(value: { toNumber?: () => number } | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

function requireText(value: string | undefined | null, code: string, max = 200): string {
  const text = (value ?? "").trim();
  if (!text || text.length > max) throw new SalesError(code);
  return text;
}

async function loadWritableDossier(user: AuthzUser, dossierId: string) {
  denyPartner(user);
  await guard(() => assertCanWriteOpportunity(user, dossierId));
  const row = await prismadb.crm_Opportunities.findFirst({
    where: { id: dossierId, is_dossier: true, deletedAt: null },
    select: { id: true, dossier_status: true, name: true },
  });
  if (!row) throw new SalesError("notFound");
  return row;
}

function assertOpen(status: string | null) {
  if (status && TERMINAL.has(status)) throw new SalesError("terminal");
}

export type CustomerHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string;
  kind: string | null;
  projectLabel: string;
};

export async function searchCustomers(user: AuthzUser, rawQuery: string): Promise<CustomerHit[]> {
  denyPartner(user);
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const contains = { contains: q, mode: "insensitive" as const };
  const rows = await prismadb.crm_Accounts.findMany({
    where: {
      AND: [
        accountReadScopeWhere(user),
        {
          OR: [
            { name: contains },
            { email: contains },
            { office_phone: contains },
            { mobile_phone: contains },
            { billing_street: contains },
            { billing_postal_code: contains },
            { billing_city: contains },
            {
              contacts: {
                some: {
                  deletedAt: null,
                  OR: [
                    { first_name: contains },
                    { last_name: contains },
                    { email: contains },
                    { personal_email: contains },
                    { office_phone: contains },
                    { mobile_phone: contains },
                  ],
                },
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      office_phone: true,
      billing_street: true,
      billing_postal_code: true,
      billing_city: true,
      customer_kind: true,
      mobile_phone: true,
      contacts: {
        where: { deletedAt: null },
        select: { first_name: true, last_name: true, mobile_phone: true, office_phone: true, email: true },
        orderBy: { cratedAt: "asc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email ?? row.contacts[0]?.email ?? null,
    phone: row.office_phone ?? row.mobile_phone ?? row.contacts[0]?.mobile_phone ?? row.contacts[0]?.office_phone ?? null,
    address: [row.billing_street, row.billing_postal_code, row.billing_city].filter(Boolean).join(", "),
    kind: row.customer_kind,
    projectLabel: customerProjectLabel({
      name: row.name,
      firstName: row.contacts[0]?.first_name,
      lastName: row.contacts[0]?.last_name,
    }),
  }));
}

export type NewCustomerInput = {
  name: string;
  role: AccountRole;
  street: string;
  postalCode: string;
  city: string;
  country?: string;
  phone: string;
  mobile: string;
  email: string;
  taxRateId: string;
  vat: string;
};

export type AanvraagInput = {
  channel: RequestChannel;
  requestDate: string;
  priceRequestDate: string;
  accountId?: string;
  customer?: NewCustomerInput;
  projectName: string;
  sellerName: string;
  projectGroup: ProjectGroup;
  projectStreet?: string;
  projectPostalCode?: string;
  projectCity?: string;
  projectCountry?: string;
  description?: string;
  notes?: string;
  nextStep?: string;
};

export async function previewDossierNumber(): Promise<string | null> {
  const row = await prismadb.numberSeries.findFirst({
    where: { scope: "dossier", isDefault: true, active: true },
    orderBy: { createdAt: "asc" },
    select: { template: true, counter: true, resetPolicy: true, currentYear: true },
  });
  if (!row) return null;
  const year = new Date().getUTCFullYear();
  const base = row.resetPolicy === "YEARLY" && row.currentYear !== year ? 0 : row.counter;
  return previewNumber(row.template, base);
}

export async function listActiveTaxRates(): Promise<{ id: string; name: string; rate: number }[]> {
  const rows = await prismadb.invoice_TaxRates.findMany({
    where: { active: true },
    orderBy: [{ isDefault: "desc" }, { rate: "desc" }],
    select: { id: true, name: true, rate: true },
  });
  return rows.map((row) => ({ id: row.id, name: row.name, rate: Number(row.rate) }));
}

export async function createAanvraag(user: AuthzUser, input: AanvraagInput): Promise<{ id: string; number: string }> {
  denyPartner(user);
  if (!CHANNELS.includes(input.channel)) throw new SalesError("channelRequired");
  if (!isSellerName(input.sellerName)) throw new SalesError("sellerRequired");
  if (!isProjectGroup(input.projectGroup)) throw new SalesError("projectGroupRequired");
  const requestDate = day(input.requestDate);
  const priceRequestDate = day(input.priceRequestDate);
  const projectName = requireText(input.projectName, "projectRequired", 500);
  const occurredAt = new Date(`${input.requestDate}T12:00:00.000Z`);
  const sellers = await prismadb.users.findMany({ select: { id: true, name: true } });
  const matchedSeller = matchSellerUser(sellers, input.sellerName);
  const assignedTo = matchedSeller?.id ?? user.id;

  let accountId = input.accountId?.trim() || "";
  if (accountId) {
    await guard(() => assertCanWriteAccount(user, accountId));
  } else if (!input.customer) {
    throw new SalesError("customerRequired");
  }

  const created = await prismadb.$transaction(async (tx) => {
    if (accountId) {
      const account = await tx.crm_Accounts.findFirst({
        where: { id: accountId, deletedAt: null },
        select: { id: true },
      });
      if (!account) throw new SalesError("notFound");
    } else {
      accountId = await createCustomer(tx, user, input.customer!);
    }

    let number: string;
    try {
      number = (await allocateNumber(tx, "dossier")).number;
    } catch (error) {
      if (error instanceof OrderError && error.code === "noSeries") throw new SalesError("noSeries");
      throw error;
    }
    const dossier = await tx.crm_Opportunities.create({
      data: {
        v: 0,
        name: projectName,
        account: accountId,
        assigned_to: assignedTo,
        createdBy: user.id,
        updatedBy: user.id,
        description: input.description?.trim() || projectName,
        internal_notes: input.notes?.trim() || null,
        next_step: input.nextStep?.trim() || null,
        is_dossier: true,
        dossier_number: number,
        dossier_status: "NIEUW",
        status: "ACTIVE",
        approval_status: "NONE",
        budget: 0,
        expected_revenue: 0,
        sales_stage: null,
        project_street: input.projectStreet?.trim() || null,
        project_postal_code: input.projectPostalCode?.trim() || null,
        project_city: input.projectCity?.trim() || null,
        project_country: input.projectCountry?.trim() || "BE",
        request_date: requestDate,
        price_request_date: priceRequestDate,
        project_group: input.projectGroup,
        seller_name: input.sellerName,
        source_channel: input.channel,
      },
      select: { id: true, dossier_number: true },
    });
    await tx.crm_DossierChannelEvents.create({
      data: {
        dossier_id: dossier.id,
        channel: input.channel,
        occurred_at: occurredAt,
        seller_id: user.id,
        is_original: true,
        createdBy: user.id,
      },
    });
    return { id: dossier.id, number: dossier.dossier_number ?? number };
  });

  await writeAuditLog({
    entityType: "opportunity",
    entityId: created.id,
    action: "created",
    changes: [
      { field: "dossier_number", old: null, new: created.number },
      { field: "dossier_status", old: null, new: "NIEUW" },
      { field: "source_channel", old: null, new: input.channel },
      { field: "seller_name", old: null, new: input.sellerName },
      { field: "project_group", old: null, new: input.projectGroup },
    ],
    userId: user.id,
  });
  return created;
}

type Tx = Parameters<Parameters<typeof prismadb.$transaction>[0]>[0];

async function createCustomer(tx: Tx, user: AuthzUser, input: NewCustomerInput): Promise<string> {
  const name = requireText(input.name, "nameRequired");
  if (!isAccountRole(input.role)) throw new SalesError("roleRequired");
  const email = input.email?.trim() || "";
  if (!email.includes("@")) throw new SalesError("emailRequired");
  const phone = requireText(input.phone, "phoneRequired", 40);
  const mobile = requireText(input.mobile, "mobileRequired", 40);
  const vat = requireText(input.vat, "vatRequired", 32);
  const street = input.street?.trim() || "";
  const postalCode = input.postalCode?.trim() || "";
  const city = input.city?.trim() || "";
  if (!street || !postalCode || !city) throw new SalesError("addressRequired");
  const taxRate = await tx.invoice_TaxRates.findFirst({
    where: { id: input.taxRateId, active: true },
    select: { id: true },
  });
  if (!taxRate) throw new SalesError("taxRateRequired");
  const account = await tx.crm_Accounts.create({
    data: {
      v: 0,
      name,
      email,
      office_phone: phone,
      mobile_phone: mobile,
      vat,
      billing_street: street,
      billing_postal_code: postalCode,
      billing_city: city,
      billing_country: input.country?.trim() || "BE",
      account_role: input.role,
      tax_rate_id: taxRate.id,
      type: input.role === "SUPPLIER" ? "Supplier" : input.role === "BOTH" ? "Customer and supplier" : "Customer",
      status: "Active",
      assigned_to: user.id,
      createdBy: user.id,
    },
    select: { id: true, name: true },
  });
  await tx.crm_Contacts.create({
    data: {
      v: 0,
      last_name: name,
      email,
      office_phone: phone,
      mobile_phone: mobile,
      accountsIDs: account.id,
      assigned_to: user.id,
      createdBy: user.id,
    },
  });
  await writeAuditLog({
    entityType: "account",
    entityId: account.id,
    action: "created",
    changes: [{ field: "name", old: null, new: account.name }],
    userId: user.id,
  });
  return account.id;
}

export type DossierListRow = {
  id: string;
  number: string | null;
  name: string | null;
  status: string | null;
  customer: string | null;
  requestDate: string | null;
  followUpDate: string | null;
  seller: string | null;
};

export async function listDossiers(user: AuthzUser): Promise<DossierListRow[]> {
  denyPartner(user);
  const rows = await prismadb.crm_Opportunities.findMany({
    where: { is_dossier: true, ...opportunityReadScopeWhere(user) },
    select: {
      id: true,
      dossier_number: true,
      name: true,
      dossier_status: true,
      request_date: true,
      follow_up_date: true,
      seller_name: true,
      assigned_account: { select: { name: true } },
      assigned_to_user: { select: { name: true } },
    },
    orderBy: [{ request_date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    number: row.dossier_number,
    name: row.name,
    status: row.dossier_status,
    customer: row.assigned_account?.name ?? null,
    requestDate: dayString(row.request_date),
    followUpDate: dayString(row.follow_up_date),
    seller: row.seller_name ?? row.assigned_to_user?.name ?? null,
  }));
}

export async function listDossiersForAccount(user: AuthzUser, accountId: string): Promise<DossierListRow[]> {
  const rows = await listDossiers(user);
  const scoped = await prismadb.crm_Opportunities.findMany({
    where: { is_dossier: true, account: accountId, ...opportunityReadScopeWhere(user) },
    select: { id: true },
  });
  const ids = new Set(scoped.map((row) => row.id));
  return rows.filter((row) => ids.has(row.id));
}

export type QuoteVersionView = {
  id: string;
  version: number;
  number: string;
  date: string;
  cost: number;
  sell: number;
  vat: number;
  marginEuro: number;
  marginPercent: number | null;
  status: string;
  notes: string | null;
  pdfId: string;
  pdfName: string;
};

export type DossierDetail = {
  id: string;
  number: string | null;
  name: string | null;
  status: string | null;
  description: string | null;
  notes: string | null;
  nextStep: string | null;
  requestDate: string | null;
  priceRequestDate: string | null;
  projectGroup: string | null;
  followUpDate: string | null;
  channel: string | null;
  lostReason: string | null;
  projectAddress: string;
  terminal: boolean;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    vat: string | null;
    address: string;
    role: string | null;
  };
  documents: { id: string; name: string; category: string | null }[];
  seller: string | null;
  channels: { id: string; channel: string; at: string; note: string | null; original: boolean; seller: string | null }[];
  families: {
    id: string;
    supplier: string;
    configurator: string;
    reference: string;
    quotes: QuoteVersionView[];
  }[];
  customerQuotes: { id: string; name: string }[];
  sends: { id: string; sentAt: string; followUp: string; quoteId: string; label: string }[];
};

export async function getDossier(user: AuthzUser, dossierId: string): Promise<DossierDetail | null> {
  denyPartner(user);
  const row = await prismadb.crm_Opportunities.findFirst({
    where: { id: dossierId, is_dossier: true, ...opportunityReadScopeWhere(user) },
    include: {
      assigned_account: {
        select: {
          id: true,
          name: true,
          email: true,
          office_phone: true,
          mobile_phone: true,
          vat: true,
          billing_street: true,
          billing_postal_code: true,
          billing_city: true,
          account_role: true,
        },
      },
      assigned_to_user: { select: { name: true } },
      channel_events: {
        orderBy: { occurred_at: "asc" },
        include: { seller: { select: { name: true } } },
      },
      quote_families: {
        orderBy: { createdAt: "asc" },
        include: {
          quotes: {
            where: { deletedAt: null },
            orderBy: { version: "asc" },
            include: { pdf: { select: { id: true, document_name: true } } },
          },
        },
      },
      quote_sends: { orderBy: { sent_at: "desc" } },
      documents: {
        include: {
          document: { select: { id: true, document_name: true, document_system_type: true, deletedAt: true } },
        },
      },
    },
  });
  if (!row || !row.assigned_account) return null;
  const quotesById = new Map<string, string>();
  const families = row.quote_families.map((family) => ({
    id: family.id,
    supplier: family.supplier,
    configurator: family.configurator_name,
    reference: family.supplier_reference,
    quotes: family.quotes.map((quote) => {
      const label = `${family.supplier} ${quote.quote_number} v${quote.version}`;
      quotesById.set(quote.id, label);
      return {
        id: quote.id,
        version: quote.version,
        number: quote.quote_number,
        date: dayString(quote.quote_date) ?? "",
        cost: money(quote.cost_excl_vat) ?? 0,
        sell: money(quote.sell_excl_vat) ?? 0,
        vat: money(quote.vat_rate) ?? 0,
        marginEuro: money(quote.margin_euro) ?? 0,
        marginPercent: money(quote.margin_percent),
        status: quote.status,
        notes: quote.internal_notes,
        pdfId: quote.pdf.id,
        pdfName: quote.pdf.document_name,
      };
    }),
  }));
  return {
    id: row.id,
    number: row.dossier_number,
    name: row.name,
    status: row.dossier_status,
    description: row.description,
    notes: row.internal_notes,
    nextStep: row.next_step,
    requestDate: dayString(row.request_date),
    priceRequestDate: dayString(row.price_request_date),
    projectGroup: row.project_group,
    followUpDate: dayString(row.follow_up_date),
    channel: row.source_channel,
    lostReason: row.lost_reason,
    projectAddress: [row.project_street, row.project_postal_code, row.project_city, row.project_country].filter(Boolean).join(", "),
    terminal: !!row.dossier_status && TERMINAL.has(row.dossier_status),
    customer: {
      id: row.assigned_account.id,
      name: row.assigned_account.name,
      email: row.assigned_account.email,
      phone: row.assigned_account.office_phone,
      mobile: row.assigned_account.mobile_phone,
      vat: row.assigned_account.vat,
      address: [row.assigned_account.billing_street, row.assigned_account.billing_postal_code, row.assigned_account.billing_city].filter(Boolean).join(", "),
      role: row.assigned_account.account_role,
    },
    documents: row.documents
      .filter((link) => link.document.deletedAt == null)
      .map((link) => ({
        id: link.document.id,
        name: link.document.document_name,
        category: link.document.document_system_type,
      })),
    seller: row.seller_name ?? row.assigned_to_user?.name ?? null,
    channels: row.channel_events.map((event) => ({
      id: event.id,
      channel: event.channel,
      at: dayString(event.occurred_at) ?? "",
      note: event.note,
      original: event.is_original,
      seller: event.seller.name,
    })),
    families,
    customerQuotes: row.documents
      .filter((link) => link.document.deletedAt == null && link.document.document_system_type === "CUSTOMER_QUOTE")
      .map((link) => ({ id: link.document.id, name: link.document.document_name })),
    sends: row.quote_sends.map((send) => ({
      id: send.id,
      sentAt: send.sent_at.toISOString(),
      followUp: dayString(send.follow_up_date) ?? "",
      quoteId: send.quote_id,
      label: quotesById.get(send.quote_id) ?? send.quote_id,
    })),
  };
}

export async function addChannelEvent(
  user: AuthzUser,
  dossierId: string,
  input: { channel: RequestChannel; date: string; note?: string },
) {
  const dossier = await loadWritableDossier(user, dossierId);
  assertOpen(dossier.dossier_status);
  if (!CHANNELS.includes(input.channel)) throw new SalesError("channelRequired");
  const when = day(input.date);
  const event = await prismadb.crm_DossierChannelEvents.create({
    data: {
      dossier_id: dossierId,
      channel: input.channel,
      occurred_at: when,
      seller_id: user.id,
      note: input.note?.trim() || null,
      is_original: false,
      createdBy: user.id,
    },
    select: { id: true },
  });
  await writeAuditLog({
    entityType: "dossier_channel",
    entityId: event.id,
    action: "created",
    changes: [{ field: "channel", old: null, new: input.channel }],
    userId: user.id,
  });
}

export async function updateDossierFields(
  user: AuthzUser,
  dossierId: string,
  input: { nextStep?: string; followUpDate?: string; notes?: string; description?: string; lostReason?: string },
) {
  const dossier = await loadWritableDossier(user, dossierId);
  const data: Prisma.crm_OpportunitiesUpdateInput = { updatedBy: user.id };
  if (input.nextStep !== undefined) data.next_step = input.nextStep.trim() || null;
  if (input.notes !== undefined) data.internal_notes = input.notes.trim() || null;
  if (input.description !== undefined) data.description = input.description.trim() || null;
  if (input.followUpDate !== undefined) {
    assertOpen(dossier.dossier_status);
    data.follow_up_date = input.followUpDate ? day(input.followUpDate) : null;
  }
  if (input.lostReason !== undefined) {
    if (dossier.dossier_status !== "VERLOREN") throw new SalesError("terminal");
    data.lost_reason = requireText(input.lostReason, "lostReason", 500);
  }
  if (!dossier.dossier_status || !TERMINAL.has(dossier.dossier_status) || input.lostReason !== undefined) {
    await prismadb.crm_Opportunities.update({ where: { id: dossierId }, data });
  }
  await writeAuditLog({
    entityType: "opportunity",
    entityId: dossierId,
    action: "updated",
    changes: [{ field: "follow_up", old: null, new: input.followUpDate ?? input.nextStep ?? input.lostReason ?? "" }],
    userId: user.id,
  });
}

export type QuoteFile = { key: string; size: number; mimeType: string; fileName: string };

async function storePdf(
  user: AuthzUser,
  dossierId: string,
  file: QuoteFile,
  systemType: "INTERNAL_SUPPLIER_QUOTE" | "CUSTOMER_QUOTE",
) {
  if (file.mimeType !== "application/pdf") throw new SalesError("pdfOnly");
  const stored = await newDocumentFile(file.key);
  const doc = await prismadb.documents.create({
    data: {
      v: 0,
      document_name: file.fileName.trim() || "offerte.pdf",
      description: systemType === "CUSTOMER_QUOTE" ? "Klantofferte" : "Leveranciersofferte",
      ...stored,
      size: file.size,
      document_file_mimeType: file.mimeType,
      document_system_type: systemType,
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
    console.error("[sales] document enrich event failed", error);
  }
  return doc.id;
}

export async function registerExternalQuote(
  user: AuthzUser,
  dossierId: string,
  input: {
    familyId?: string;
    supplier?: string;
    configurator?: string;
    supplierReference?: string;
    quoteNumber: string;
    quoteDate: string;
    cost: string;
    sell: string;
    vatRate: string;
    notes?: string;
    file: QuoteFile;
  },
) {
  const dossier = await loadWritableDossier(user, dossierId);
  assertOpen(dossier.dossier_status);
  const margin = quoteMargin(input.cost, input.sell, input.vatRate);
  const quoteNumber = requireText(input.quoteNumber, "nameRequired", 80);
  const quoteDate = day(input.quoteDate);
  const pdfId = await storePdf(user, dossierId, input.file, "INTERNAL_SUPPLIER_QUOTE");

  let quoteId = "";
  try {
    quoteId = await prismadb.$transaction(async (tx) => {
      let familyId = input.familyId?.trim() || "";
      let version = 1;
      if (!familyId) {
        const supplier = requireText(input.supplier, "nameRequired", 120);
        const configurator = requireText(input.configurator, "nameRequired", 120);
        const reference = requireText(input.supplierReference, "nameRequired", 120);
        const family = await tx.crm_ExternalQuoteFamilies.create({
          data: {
            dossier_id: dossierId,
            supplier,
            configurator_name: configurator,
            supplier_reference: reference,
            createdBy: user.id,
          },
          select: { id: true },
        });
        familyId = family.id;
      } else {
        const family = await tx.crm_ExternalQuoteFamilies.findFirst({
          where: { id: familyId, dossier_id: dossierId },
          select: { id: true },
        });
        if (!family) throw new SalesError("notFound");
        const last = await tx.crm_ExternalQuotes.findFirst({
          where: { family_id: familyId, deletedAt: null },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        version = (last?.version ?? 0) + 1;
        await tx.crm_ExternalQuotes.updateMany({
          where: { family_id: familyId, status: "ACTIVE", deletedAt: null },
          data: { status: "HISTORICAL" },
        });
      }
      const quote = await tx.crm_ExternalQuotes.create({
        data: {
          family_id: familyId,
          version,
          quote_number: quoteNumber,
          quote_date: quoteDate,
          pdf_document_id: pdfId,
          cost_excl_vat: margin.cost,
          sell_excl_vat: margin.sell,
          vat_rate: margin.vatRate,
          margin_euro: margin.marginEuro,
          margin_percent: margin.marginPercent,
          currency: "EUR",
          internal_notes: input.notes?.trim() || null,
          status: "ACTIVE",
          createdBy: user.id,
        },
        select: { id: true },
      });
      if (dossier.dossier_status === "NIEUW") {
        await tx.crm_Opportunities.update({
          where: { id: dossierId },
          data: { dossier_status: "IN_OPMAAK", updatedBy: user.id },
        });
      }
      return quote.id;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new SalesError("duplicateFamily");
    }
    throw error;
  }

  await writeAuditLog({
    entityType: "external_quote",
    entityId: quoteId,
    action: "imported",
    changes: [
      { field: "quote_number", old: null, new: quoteNumber },
      { field: "sell_excl_vat", old: null, new: margin.sell.toString() },
      { field: "cost_excl_vat", old: null, new: margin.cost.toString() },
      { field: "margin_euro", old: null, new: margin.marginEuro.toString() },
    ],
    userId: user.id,
  });
  return quoteId;
}

export async function attachDossierDocument(
  user: AuthzUser,
  dossierId: string,
  file: QuoteFile & { category: DossierDocumentCategory },
) {
  const dossier = await loadWritableDossier(user, dossierId);
  assertOpen(dossier.dossier_status);
  if (!(DOSSIER_DOCUMENT_CATEGORIES as readonly string[]).includes(file.category)) {
    throw new SalesError("categoryRequired");
  }
  if (!uploadExtension(file.mimeType)) throw new SalesError("fileType");
  const stored = await newDocumentFile(file.key);
  const doc = await prismadb.documents.create({
    data: {
      v: 0,
      document_name: file.fileName.trim() || "document",
      description: file.category,
      ...stored,
      size: file.size,
      document_file_mimeType: file.mimeType,
      document_system_type: file.category,
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
    console.error("[sales] document enrich event failed", error);
  }
  await writeAuditLog({
    entityType: "opportunity",
    entityId: dossierId,
    action: "relation_added",
    changes: [{ field: "document", old: null, new: doc.id }],
    userId: user.id,
  });
  return doc.id;
}

export async function uploadCustomerQuote(user: AuthzUser, dossierId: string, file: QuoteFile) {
  const dossier = await loadWritableDossier(user, dossierId);
  assertOpen(dossier.dossier_status);
  const id = await storePdf(user, dossierId, file, "CUSTOMER_QUOTE");
  await writeAuditLog({
    entityType: "opportunity",
    entityId: dossierId,
    action: "relation_added",
    changes: [{ field: "customer_quote", old: null, new: id }],
    userId: user.id,
  });
  return id;
}

async function hasCustomerQuote(dossierId: string) {
  const doc = await prismadb.documents.findFirst({
    where: {
      deletedAt: null,
      document_system_type: "CUSTOMER_QUOTE",
      opportunities: { some: { opportunity_id: dossierId } },
    },
    select: { id: true },
  });
  return !!doc;
}

export async function markOfferteKlaar(user: AuthzUser, dossierId: string) {
  const dossier = await loadWritableDossier(user, dossierId);
  assertOpen(dossier.dossier_status);
  if (!(await hasCustomerQuote(dossierId))) throw new SalesError("noCustomerQuote");
  await prismadb.crm_Opportunities.update({
    where: { id: dossierId },
    data: { dossier_status: "OFFERTE_KLAAR", updatedBy: user.id },
  });
  await writeAuditLog({
    entityType: "opportunity",
    entityId: dossierId,
    action: "updated",
    changes: [{ field: "dossier_status", old: dossier.dossier_status, new: "OFFERTE_KLAAR" }],
    userId: user.id,
  });
}

export async function markSent(
  user: AuthzUser,
  dossierId: string,
  input: { quoteId: string; documentId: string; followUpDate: string; method?: "MANUAL" | "EMAIL" },
) {
  const dossier = await loadWritableDossier(user, dossierId);
  assertOpen(dossier.dossier_status);
  if (input.method === "EMAIL") throw new SalesError("emailLater");
  const followUp = day(input.followUpDate);
  const quote = await prismadb.crm_ExternalQuotes.findFirst({
    where: { id: input.quoteId, deletedAt: null, family: { dossier_id: dossierId } },
    select: { id: true, quote_number: true },
  });
  if (!quote) throw new SalesError("quoteRequired");
  const document = await prismadb.documents.findFirst({
    where: {
      id: input.documentId,
      deletedAt: null,
      document_system_type: "CUSTOMER_QUOTE",
      opportunities: { some: { opportunity_id: dossierId } },
    },
    select: { id: true },
  });
  if (!document) throw new SalesError("notCustomerQuote");
  const sentAt = new Date();
  const send = await prismadb.crm_QuoteSends.create({
    data: {
      dossier_id: dossierId,
      quote_id: quote.id,
      document_id: document.id,
      method: "MANUAL",
      sent_at: sentAt,
      follow_up_date: followUp,
      sent_by: user.id,
    },
    select: { id: true },
  });
  await prismadb.crm_Opportunities.update({
    where: { id: dossierId },
    data: {
      dossier_status: "OFFERTE_VERSTUURD",
      follow_up_date: followUp,
      updatedBy: user.id,
    },
  });
  await writeAuditLog({
    entityType: "quote_send",
    entityId: send.id,
    action: "created",
    changes: [
      { field: "quote_id", old: null, new: quote.id },
      { field: "document_id", old: null, new: document.id },
      { field: "method", old: null, new: "MANUAL" },
      { field: "sent_at", old: null, new: sentAt.toISOString() },
    ],
    userId: user.id,
  });
}

export async function changeDossierStatus(
  user: AuthzUser,
  dossierId: string,
  input: { status: DossierStatus; lostReason?: string; acceptedQuoteId?: string },
) {
  const dossier = await loadWritableDossier(user, dossierId);
  assertOpen(dossier.dossier_status);
  if (!DOSSIER_STATUSES.includes(input.status)) throw new SalesError("notFound");
  if (input.status === "OFFERTE_VERSTUURD") throw new SalesError("notFound");
  const data: Prisma.crm_OpportunitiesUpdateInput = {
    dossier_status: input.status,
    updatedBy: user.id,
  };
  if (input.status === "VERLOREN") {
    data.lost_reason = requireText(input.lostReason, "lostReason", 500);
    data.lost_at = new Date();
  }
  if (input.status === "GEWONNEN") {
    const quoteId = input.acceptedQuoteId?.trim() || "";
    if (!quoteId) throw new SalesError("quoteRequired");
    const quote = await prismadb.crm_ExternalQuotes.findFirst({
      where: { id: quoteId, deletedAt: null, family: { dossier_id: dossierId } },
      select: { id: true },
    });
    if (!quote) throw new SalesError("quoteRequired");
    data.accepted_quote = { connect: { id: quote.id } };
    data.won_at = new Date();
  }
  if (input.status === "OFFERTE_KLAAR" && !(await hasCustomerQuote(dossierId))) {
    throw new SalesError("noCustomerQuote");
  }
  await prismadb.crm_Opportunities.update({ where: { id: dossierId }, data });
  await writeAuditLog({
    entityType: "opportunity",
    entityId: dossierId,
    action: "updated",
    changes: [
      { field: "dossier_status", old: dossier.dossier_status, new: input.status },
      ...(input.status === "VERLOREN" ? [{ field: "lost_reason", old: null, new: input.lostReason?.trim() ?? "" }] : []),
      ...(input.status === "GEWONNEN" ? [{ field: "accepted_quote_id", old: null, new: input.acceptedQuoteId ?? "" }] : []),
    ],
    userId: user.id,
  });
}

export type OfferteRow = {
  id: string;
  supplier: string;
  configurator: string;
  reference: string;
  number: string;
  version: number;
  date: string;
  sell: number;
  marginEuro: number;
  marginPercent: number | null;
  status: string;
  dossierId: string;
  dossierNumber: string | null;
  dossierName: string | null;
};

export async function listOffertes(
  user: AuthzUser,
  filter: { supplier?: string; status?: string },
): Promise<OfferteRow[]> {
  denyPartner(user);
  const supplier = filter.supplier?.trim();
  const rows = await prismadb.crm_ExternalQuotes.findMany({
    where: {
      deletedAt: null,
      ...(filter.status === "ACTIVE" || filter.status === "HISTORICAL" ? { status: filter.status } : {}),
      family: {
        ...(supplier ? { supplier: { contains: supplier, mode: "insensitive" } } : {}),
        dossier: { is_dossier: true, ...opportunityReadScopeWhere(user) },
      },
    },
    include: {
      family: {
        select: {
          supplier: true,
          configurator_name: true,
          supplier_reference: true,
          dossier: { select: { id: true, dossier_number: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((row) => ({
    id: row.id,
    supplier: row.family.supplier,
    configurator: row.family.configurator_name,
    reference: row.family.supplier_reference,
    number: row.quote_number,
    version: row.version,
    date: dayString(row.quote_date) ?? "",
    sell: money(row.sell_excl_vat) ?? 0,
    marginEuro: money(row.margin_euro) ?? 0,
    marginPercent: money(row.margin_percent),
    status: row.status,
    dossierId: row.family.dossier.id,
    dossierNumber: row.family.dossier.dossier_number,
    dossierName: row.family.dossier.name,
  }));
}

export async function getSalesDashboard(user: AuthzUser): Promise<SalesTiles> {
  denyPartner(user);
  const rows = await prismadb.crm_Opportunities.findMany({
    where: { is_dossier: true, ...opportunityReadScopeWhere(user) },
    select: {
      dossier_status: true,
      request_date: true,
      follow_up_date: true,
      won_at: true,
      lost_at: true,
      accepted_quote: { select: { sell_excl_vat: true, margin_euro: true } },
      quote_sends: {
        orderBy: { sent_at: "desc" },
        take: 1,
        select: { quote: { select: { sell_excl_vat: true, margin_euro: true } } },
      },
    },
  });
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const dashRows: DashRow[] = rows.map((row) => {
    const sent = row.quote_sends[0]?.quote;
    return {
      status: row.dossier_status ?? "NIEUW",
      requestDate: dayString(row.request_date),
      followUpDate: dayString(row.follow_up_date),
      wonAt: row.won_at ? row.won_at.toISOString() : null,
      lostAt: row.lost_at ? row.lost_at.toISOString() : null,
      acceptedSell: money(row.accepted_quote?.sell_excl_vat),
      acceptedMargin: money(row.accepted_quote?.margin_euro),
      latestSentSell: sent ? money(sent.sell_excl_vat) : null,
      latestSentMargin: sent ? money(sent.margin_euro) : null,
    };
  });
  return salesTiles(dashRows, monthStart, monthEnd, today);
}
