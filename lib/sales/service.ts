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
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { logikalCanCreateProject, logikalMissingSettings } from "@/lib/sales/logikal/connection";
import { SalesError } from "./errors";
import { dossierIsReadOnly } from "./dossier-lock";
import { buildDossierStepper, currentDossierStep } from "./dossier-step";
import { parseGrossTotalInput } from "./gross-total";
import { quoteMargin } from "./margin";
import { salesTiles, type DashRow, type SalesTiles } from "./dashboard-math";
import { dossierOpenLabel } from "./recent-opens";
import { dossierTaskKind, type DossierTaskKind } from "./task-lists";
import { distributedMailsToMake, mergeDistributedIntoToMake, type DistributedMail } from "./distributed-requests";
import { DOSSIER_STATUSES, DOSSIER_DOCUMENT_CATEGORIES, systemTypeForFiling, type DossierDocumentCategory, type DossierStatus, type RequestChannel, CHANNELS } from "./labels";
import { uploadExtension } from "@/lib/upload-content-types";
import { previewNumber } from "@/lib/orders/numbering";
import {
  isAccountRole,
  isProjectGroup,
  isSellerName,
  isVatChoice,
  matchSellerUser,
  customerProjectLabel,
  type AccountRole,
  type ProjectGroup,
  type VatChoice,
} from "./aanvraag-fields";
import {
  ArchitectDirectoryError,
  ArchitectSelectionError,
  queryArchitectDirectory,
  resolveArchitect,
  type ArchitectHit,
} from "./architects";

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

function optionalText(value: string | undefined | null, code: string, max = 200): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  if (text.length > max) throw new SalesError(code);
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
  if (dossierIsReadOnly(status)) throw new SalesError("terminal");
}

export type CustomerHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  state: string | null;
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
      billing_country: true,
      billing_state: true,
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
    street: row.billing_street,
    postalCode: row.billing_postal_code,
    city: row.billing_city,
    country: row.billing_country,
    state: row.billing_state,
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
  vatChoice: VatChoice;
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
  architectName?: string;
  architectExternalId?: string;
  description?: string;
  notes?: string;
  nextStep?: string;
};

export async function searchArchitects(user: AuthzUser, rawQuery: string): Promise<ArchitectHit[]> {
  denyPartner(user);
  try {
    return await queryArchitectDirectory(rawQuery);
  } catch (error) {
    if (error instanceof ArchitectDirectoryError) throw new SalesError("architectUnavailable");
    throw error;
  }
}

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

export async function createAanvraag(user: AuthzUser, input: AanvraagInput): Promise<{ id: string; number: string }> {
  denyPartner(user);
  if (!CHANNELS.includes(input.channel)) throw new SalesError("channelRequired");
  if (!isSellerName(input.sellerName)) throw new SalesError("sellerRequired");
  if (!isProjectGroup(input.projectGroup)) throw new SalesError("projectGroupRequired");
  const requestDate = day(input.requestDate);
  const priceRequestDate = day(input.priceRequestDate);
  const projectName = requireText(input.projectName, "projectRequired", 500);
  let architect: { name: string; externalId: string } | null = null;
  try {
    architect = await resolveArchitect(input.architectName, input.architectExternalId);
  } catch (error) {
    if (error instanceof ArchitectSelectionError) throw new SalesError("architectInvalid");
    if (error instanceof ArchitectDirectoryError) throw new SalesError("architectUnavailable");
    throw error;
  }
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
        architect_name: architect?.name ?? null,
        architect_external_id: architect?.externalId ?? null,
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
      ...(architect
        ? [
            { field: "architect_name", old: null, new: architect.name },
            { field: "architect_external_id", old: null, new: architect.externalId },
          ]
        : []),
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
  const phone = optionalText(input.phone, "phoneRequired", 40);
  const mobile = optionalText(input.mobile, "mobileRequired", 40);
  if (!phone && !mobile) throw new SalesError("phoneOrMobileRequired");
  const vat = optionalText(input.vat, "vatRequired", 32);
  const street = input.street?.trim() || "";
  const postalCode = input.postalCode?.trim() || "";
  const city = input.city?.trim() || "";
  if (!street || !postalCode || !city) throw new SalesError("addressRequired");
  if (!isVatChoice(input.vatChoice)) throw new SalesError("vatChoiceRequired");
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
      vat_choice: input.vatChoice,
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
  stepLabel: string;
  customer: string | null;
  contactType: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  vat: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  seller: string | null;
  architectName: string | null;
  architectExternalId: string | null;
  projectGroup: string | null;
  requestDate: string | null;
  priceRequestDate: string | null;
  followUpDate: string | null;
  projectStreet: string | null;
  projectPostalCode: string | null;
  projectCity: string | null;
  projectCountry: string | null;
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
      price_request_date: true,
      follow_up_date: true,
      seller_name: true,
      architect_name: true,
      architect_external_id: true,
      project_group: true,
      project_street: true,
      project_postal_code: true,
      project_city: true,
      project_country: true,
      assigned_account: {
        select: {
          name: true,
          account_role: true,
          email: true,
          office_phone: true,
          mobile_phone: true,
          vat: true,
          billing_street: true,
          billing_postal_code: true,
          billing_city: true,
        },
      },
      assigned_to_user: { select: { name: true } },
      quote_sends: { select: { sent_at: true }, orderBy: { sent_at: "asc" }, take: 1 },
      documents: {
        where: { document: { deletedAt: null } },
        select: { document_id: true },
        take: 1,
      },
    },
    orderBy: [{ request_date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    number: row.dossier_number,
    name: row.name,
    status: row.dossier_status,
    stepLabel: buildDossierStepper({
      hasDocuments: row.documents.length > 0,
      sentAt: row.quote_sends[0]?.sent_at.toISOString() ?? null,
      status: row.dossier_status,
    }).currentLabel,
    customer: row.assigned_account?.name ?? null,
    contactType: row.assigned_account?.account_role ?? null,
    email: row.assigned_account?.email ?? null,
    phone: row.assigned_account?.office_phone ?? null,
    mobile: row.assigned_account?.mobile_phone ?? null,
    vat: row.assigned_account?.vat ?? null,
    street: row.assigned_account?.billing_street ?? null,
    postalCode: row.assigned_account?.billing_postal_code ?? null,
    city: row.assigned_account?.billing_city ?? null,
    seller: row.seller_name ?? row.assigned_to_user?.name ?? null,
    architectName: row.architect_name,
    architectExternalId: row.architect_external_id,
    projectGroup: row.project_group,
    requestDate: dayString(row.request_date),
    priceRequestDate: dayString(row.price_request_date),
    followUpDate: dayString(row.follow_up_date),
    projectStreet: row.project_street,
    projectPostalCode: row.project_postal_code,
    projectCity: row.project_city,
    projectCountry: row.project_country,
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
  gross: number | null;
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
  architectName: string | null;
  architectExternalId: string | null;
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
  acceptedQuote: { id: string; name: string; gross: number | null } | null;
  logikal: {
    projectId: string | null;
    projectName: string | null;
    linkState: string | null;
    importedAt: string | null;
    canCreate: boolean;
    missingSettings: string[];
    positions: {
      id: string;
      name: string;
      quantity: number;
      quoteText: string | null;
      description: string | null;
      hasDrawing: boolean;
    }[];
  };
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
      accepted_quote: {
        select: {
          id: true,
          total_bruto: true,
          deletedAt: true,
          pdf: { select: { document_name: true } },
        },
      },
      documents: {
        include: {
          document: { select: { id: true, document_name: true, document_system_type: true, filing_category: true, deletedAt: true } },
        },
      },
      logikal_positions: { orderBy: { sort_order: "asc" } },
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
        gross: money(quote.total_bruto),
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
    architectName: row.architect_name,
    architectExternalId: row.architect_external_id,
    followUpDate: dayString(row.follow_up_date),
    channel: row.source_channel,
    lostReason: row.lost_reason,
    projectAddress: [row.project_street, row.project_postal_code, row.project_city, row.project_country].filter(Boolean).join(", "),
    terminal: dossierIsReadOnly(row.dossier_status),
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
        category: link.document.filing_category ?? link.document.document_system_type,
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
    acceptedQuote: row.accepted_quote && row.accepted_quote.deletedAt == null
      ? {
          id: row.accepted_quote.id,
          name: row.accepted_quote.pdf.document_name,
          gross: money(row.accepted_quote.total_bruto),
        }
      : null,
    logikal: {
      projectId: row.logikal_project_id,
      projectName: row.logikal_project_name,
      linkState: row.logikal_link_state,
      importedAt: row.logikal_imported_at?.toISOString() ?? null,
      canCreate: logikalCanCreateProject(),
      missingSettings: logikalMissingSettings(),
      positions: serializeDecimalsList(row.logikal_positions).map((position) => ({
        id: position.id,
        name: position.position_name,
        quantity: Number(position.quantity),
        quoteText: position.quote_text,
        description: position.description,
        hasDrawing: position.drawing_key != null,
      })),
    },
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
  if (!dossier.dossier_status || !dossierIsReadOnly(dossier.dossier_status) || input.lostReason !== undefined) {
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

async function resolveGrossTotal(file: QuoteFile & { grossTotal?: string }) {
  let fromPdf: string | null = null;
  try {
    const { grossTotalFromStoredPdf } = await import("./pdf-text");
    fromPdf = await grossTotalFromStoredPdf(file.key);
  } catch (error) {
    console.error("[sales] quote total extract failed", error);
  }
  const raw = fromPdf ?? file.grossTotal;
  if (raw == null || raw.trim() === "") throw new SalesError("priceRequired");
  return new Prisma.Decimal(parseGrossTotalInput(raw));
}

/** PDF from the external program, stored on the dossier and listed under Offertes. */
export async function attachOffertePdf(user: AuthzUser, dossierId: string, file: QuoteFile & { grossTotal?: string }) {
  const dossier = await loadWritableDossier(user, dossierId);
  assertOpen(dossier.dossier_status);
  const totalBruto = await resolveGrossTotal(file);
  const pdfId = await storePdf(user, dossierId, file, "CUSTOMER_QUOTE");
  await prismadb.documents.update({
    where: { id: pdfId },
    data: { filing_category: "OFFERTE", description: "Offerte" },
  });
  const quoteNumber = (file.fileName.replace(/\.pdf$/i, "").trim() || "Offerte").slice(0, 80);
  const quoteDate = day(new Date().toISOString().slice(0, 10));
  const margin = quoteMargin("0", "0", "21");

  let quoteId = "";
  try {
    quoteId = await prismadb.$transaction(async (tx) => {
      const family = await tx.crm_ExternalQuoteFamilies.create({
        data: {
          dossier_id: dossierId,
          supplier: "Extern",
          configurator_name: "PDF",
          supplier_reference: pdfId,
          createdBy: user.id,
        },
        select: { id: true },
      });
      const quote = await tx.crm_ExternalQuotes.create({
        data: {
          family_id: family.id,
          version: 1,
          quote_number: quoteNumber,
          quote_date: quoteDate,
          pdf_document_id: pdfId,
          cost_excl_vat: margin.cost,
          sell_excl_vat: margin.sell,
          vat_rate: margin.vatRate,
          total_bruto: totalBruto,
          margin_euro: margin.marginEuro,
          margin_percent: margin.marginPercent,
          currency: "EUR",
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
      { field: "pdf_document_id", old: null, new: pdfId },
      { field: "total_bruto", old: null, new: totalBruto.toString() },
    ],
    userId: user.id,
  });
  return quoteId;
}

const QUOTE_FILE_TYPES = new Set(["CUSTOMER_QUOTE", "INTERNAL_SUPPLIER_QUOTE"]);

type QuotePdfForDelete = {
  id: string;
  document_system_type: string | null;
  deletedAt: Date | null;
  opportunities: { opportunity_id: string }[];
  accounts: { account_id: string }[];
  contacts: { contact_id: string }[];
  tasks: { task_id: string }[];
  leads: { lead_id: string }[];
  crm_accounts_tasks: { crm_accounts_task_id: string }[];
};

/** Soft-delete the PDF only when this quote is that file and nothing else uses it. */
async function retireQuoteDocument(
  tx: Prisma.TransactionClient,
  dossierId: string,
  quoteId: string,
  pdf: QuotePdfForDelete,
  userId: string,
) {
  if (pdf.deletedAt != null) return;
  if (!pdf.document_system_type || !QUOTE_FILE_TYPES.has(pdf.document_system_type)) return;
  const onlyThisDossier = pdf.opportunities.length > 0
    && pdf.opportunities.every((link) => link.opportunity_id === dossierId);
  const sharedElsewhere = pdf.accounts.length > 0
    || pdf.contacts.length > 0
    || pdf.tasks.length > 0
    || pdf.leads.length > 0
    || pdf.crm_accounts_tasks.length > 0;
  if (!onlyThisDossier || sharedElsewhere) return;
  const stillUsed = await tx.crm_ExternalQuotes.count({
    where: { pdf_document_id: pdf.id, deletedAt: null, id: { not: quoteId } },
  });
  if (stillUsed > 0) return;
  await tx.documents.update({
    where: { id: pdf.id },
    data: { deletedAt: new Date(), deletedBy: userId },
  });
}

/** Removes one quote from the dossier. A sent quote can go; a closed dossier cannot. */
export async function deleteOfferte(user: AuthzUser, dossierId: string, quoteId: string) {
  const dossier = await loadWritableDossier(user, dossierId);
  assertOpen(dossier.dossier_status);
  const id = quoteId.trim();
  if (!id) throw new SalesError("notFound");

  const removed = await prismadb.$transaction(async (tx) => {
    const quote = await tx.crm_ExternalQuotes.findFirst({
      where: { id, deletedAt: null, family: { dossier_id: dossierId } },
      select: {
        id: true,
        quote_number: true,
        pdf: {
          select: {
            id: true,
            document_system_type: true,
            deletedAt: true,
            opportunities: { select: { opportunity_id: true } },
            accounts: { select: { account_id: true }, take: 1 },
            contacts: { select: { contact_id: true }, take: 1 },
            tasks: { select: { task_id: true }, take: 1 },
            leads: { select: { lead_id: true }, take: 1 },
            crm_accounts_tasks: { select: { crm_accounts_task_id: true }, take: 1 },
          },
        },
      },
    });
    if (!quote) throw new SalesError("notFound");
    await tx.crm_ExternalQuotes.update({
      where: { id: quote.id },
      data: { deletedAt: new Date() },
    });
    await retireQuoteDocument(tx, dossierId, quote.id, quote.pdf, user.id);
    return { id: quote.id, number: quote.quote_number };
  });

  await writeAuditLog({
    entityType: "external_quote",
    entityId: removed.id,
    action: "deleted",
    changes: [{ field: "quote_number", old: removed.number, new: null }],
    userId: user.id,
  });
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
      document_system_type: systemTypeForFiling(file.category),
      filing_category: file.category,
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
  if (dossier.dossier_status === "GEWONNEN") return;
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
      ...(dossier.dossier_status === "GEWONNEN" ? {} : { dossier_status: "OFFERTE_VERSTUURD" as const }),
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
      select: { id: true, total_bruto: true },
    });
    if (!quote) throw new SalesError("quoteRequired");
    if (quote.total_bruto == null) throw new SalesError("winnerPrice");
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
        select: { sent_at: true, quote: { select: { sell_excl_vat: true, margin_euro: true } } },
      },
      documents: {
        where: { document: { deletedAt: null } },
        select: { document_id: true },
        take: 1,
      },
    },
  });
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const dashRows: DashRow[] = rows.map((row) => {
    const latest = row.quote_sends[0];
    const earliest = row.quote_sends.at(-1);
    const sent = latest?.quote;
    return {
      status: row.dossier_status ?? "NIEUW",
      step: currentDossierStep({
        hasDocuments: row.documents.length > 0,
        sentAt: earliest?.sent_at.toISOString() ?? null,
        status: row.dossier_status,
        now,
      }),
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

export type SalesTask = {
  id: string;
  label: string;
  href: string;
  /** A distributed Offertebox mail that still has no dossier. Null for a dossier row. */
  request: { sender: string; subject: string } | null;
};

export type SalesTaskLists = Record<DossierTaskKind, SalesTask[]>;

export async function listSalesTasks(user: AuthzUser): Promise<SalesTaskLists> {
  denyPartner(user);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [rows, mails] = await Promise.all([
    prismadb.crm_Opportunities.findMany({
      where: { is_dossier: true, ...opportunityReadScopeWhere(user) },
      select: {
        id: true,
        dossier_number: true,
        name: true,
        dossier_status: true,
        follow_up_date: true,
        assigned_account: { select: { name: true } },
        quote_sends: { select: { sent_at: true }, orderBy: { sent_at: "desc" }, take: 1 },
        documents: {
          where: { document: { deletedAt: null } },
          select: { document_id: true },
          take: 1,
        },
      },
      orderBy: [{ request_date: "asc" }, { createdAt: "asc" }],
    }),
    prismadb.crm_OfferteboxItems.findMany({
      select: {
        id: true,
        seller_name: true,
        from_name: true,
        from_email: true,
        subject: true,
        dossier: { select: { id: true, deletedAt: true, seller_name: true } },
      },
      orderBy: [{ received_at: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  const readable = new Map(
    rows.map((row) => [
      row.id,
      {
        label: dossierOpenLabel(row.dossier_number, row.assigned_account?.name ?? row.name),
        quoteSent: row.quote_sends.length > 0,
      },
    ]),
  );
  const lists: SalesTaskLists = { toMake: [], inProgress: [], followUp: [] };
  for (const row of rows) {
    const kind = dossierTaskKind({
      status: row.dossier_status,
      hasDocuments: row.documents.length > 0,
      sentAt: row.quote_sends[0]?.sent_at.toISOString() ?? null,
      followUpDate: dayString(row.follow_up_date),
      now,
      today,
    });
    if (!kind) continue;
    const known = readable.get(row.id);
    lists[kind].push({
      id: row.id,
      label: known?.label ?? dossierOpenLabel(row.dossier_number, row.assigned_account?.name ?? row.name),
      href: `/crm/dossiers/${row.id}`,
      request: null,
    });
  }
  const listed = new Set([...lists.toMake, ...lists.inProgress, ...lists.followUp].map((task) => task.id));
  const additions = distributedMailsToMake(listed, mails.map((mail) => toDistributedMail(mail, readable)));
  lists.toMake = mergeDistributedIntoToMake(lists.toMake, additions);
  return lists;
}

function toDistributedMail(
  mail: {
    id: string;
    seller_name: string | null;
    from_name: string | null;
    from_email: string | null;
    subject: string;
    dossier: { id: string; deletedAt: Date | null; seller_name: string | null } | null;
  },
  readable: ReadonlyMap<string, { label: string; quoteSent: boolean }>,
): DistributedMail {
  const active = mail.dossier && !mail.dossier.deletedAt ? mail.dossier : null;
  const known = active ? readable.get(active.id) : undefined;
  const seller = (active?.seller_name ?? mail.seller_name)?.trim() || null;
  return {
    id: mail.id,
    sellerName: seller,
    fromName: mail.from_name?.trim() ?? "",
    fromEmail: mail.from_email?.trim() ?? "",
    subject: mail.subject?.trim() ?? "",
    dossier: active && known ? { id: active.id, label: known.label, quoteSent: known.quoteSent } : null,
    dossierHidden: Boolean(active) && !known,
  };
}
