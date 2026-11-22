import { Prisma } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import type { AuthzUser } from "@/lib/authz/session";
import { opportunityReadScopeWhere } from "@/lib/authz/scopes/crm";
import { projectLeaderNameForUser } from "./projectbox";
import { currentDossierStep } from "./dossier-step";
import { SalesError } from "./errors";
import { formatProjectNumber, projectCreationAllowed } from "./project-number";

type RawClient = { $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T> };

/** Atomic yearly counter. The first project of a year gets sequence 1. */
export async function allocateProjectNumber(tx: RawClient, now: Date = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const rows = await tx.$queryRaw<{ counter: number }[]>(Prisma.sql`
    UPDATE "NumberSeries"
    SET "counter" = CASE WHEN "resetPolicy" = 'YEARLY' AND "currentYear" IS DISTINCT FROM ${year} THEN 1 ELSE "counter" + 1 END,
        "currentYear" = ${year},
        "updatedAt" = now()
    WHERE "id" = (
      SELECT "id" FROM "NumberSeries" WHERE "scope" = 'project' AND "isDefault" AND "active" ORDER BY "createdAt" LIMIT 1
    )
    RETURNING "counter"`);
  const row = rows[0];
  if (!row) throw new SalesError("noSeries");
  return formatProjectNumber(Number(row.counter), year);
}

function denyPartner(user: AuthzUser) {
  if (user.role === "partner") throw new SalesError("forbidden");
}

/** A projectleider sees every project. A verkoper stays on their own dossiers. */
function projectReadWhere(user: AuthzUser) {
  if (projectLeaderNameForUser(user)) return { deletedAt: null };
  return opportunityReadScopeWhere(user);
}

export type ProjectListRow = {
  id: string;
  projectNumber: string;
  dossierNumber: string | null;
  name: string | null;
  customer: string | null;
  seller: string | null;
  projectGroup: string | null;
  createdAt: string | null;
};

export async function listProjects(user: AuthzUser): Promise<ProjectListRow[]> {
  denyPartner(user);
  const rows = await prismadb.crm_Opportunities.findMany({
    where: {
      is_dossier: true,
      execution_project_number: { not: null },
      ...projectReadWhere(user),
    },
    select: {
      id: true,
      execution_project_number: true,
      dossier_number: true,
      name: true,
      seller_name: true,
      project_group: true,
      project_created_at: true,
      assigned_account: { select: { name: true } },
      assigned_to_user: { select: { name: true } },
    },
    orderBy: [{ project_created_at: "desc" }, { createdAt: "desc" }],
  });
  return rows.flatMap((row) => {
    if (!row.execution_project_number) return [];
    return [{
      id: row.id,
      projectNumber: row.execution_project_number,
      dossierNumber: row.dossier_number,
      name: row.name,
      customer: row.assigned_account?.name ?? null,
      seller: row.seller_name ?? row.assigned_to_user?.name ?? null,
      projectGroup: row.project_group,
      createdAt: row.project_created_at?.toISOString() ?? null,
    }];
  });
}

function dayString(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function money(value: { toNumber?: () => number } | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

function joinParts(parts: readonly (string | null | undefined)[]): string {
  return parts.map((part) => part?.trim() ?? "").filter(Boolean).join(", ");
}

export type ProjectQuoteLine = {
  id: string;
  name: string;
  date: string | null;
  gross: number | null;
  won: boolean;
};

export type ProjectFollowUpLine = {
  id: string;
  at: string;
  channel: string;
  seller: string | null;
  note: string | null;
  original: boolean;
};

export type ProjectDocumentLine = {
  id: string;
  name: string;
  category: string | null;
};

/** Stored project fields only. Nothing here is calculated into a new price. */
export type ProjectBoardRow = {
  id: string;
  projectNumber: string;
  dossierNumber: string | null;
  name: string | null;
  status: string;
  seller: string | null;
  customerId: string | null;
  customer: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  vat: string | null;
  customerAddress: string;
  projectGroup: string | null;
  architectName: string | null;
  architectExternalId: string | null;
  priceRequestDate: string | null;
  requestDate: string | null;
  followUpDate: string | null;
  siteAddress: string;
  channel: string | null;
  nextStep: string | null;
  notes: string | null;
  createdAt: string | null;
  quotes: ProjectQuoteLine[];
  documents: ProjectDocumentLine[];
  followUps: ProjectFollowUpLine[];
};

export type ProjectDashboard = {
  projectCount: number;
  newThisMonth: number;
  wonWithoutProjectCount: number;
  wonWithoutProject: { id: string; number: string | null; name: string | null; customer: string | null; seller: string | null }[];
  projects: ProjectBoardRow[];
};

export async function getProjectDashboard(user: AuthzUser, now = new Date()): Promise<ProjectDashboard> {
  denyPartner(user);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const waitingWhere = {
    is_dossier: true,
    dossier_status: "GEWONNEN" as const,
    execution_project_number: null,
    ...projectReadWhere(user),
  };
  const [rows, waitingCount, waiting] = await Promise.all([
    prismadb.crm_Opportunities.findMany({
      where: {
        is_dossier: true,
        execution_project_number: { not: null },
        ...projectReadWhere(user),
      },
      select: {
        id: true,
        execution_project_number: true,
        dossier_number: true,
        name: true,
        dossier_status: true,
        seller_name: true,
        project_group: true,
        architect_name: true,
        architect_external_id: true,
        price_request_date: true,
        request_date: true,
        follow_up_date: true,
        project_street: true,
        project_postal_code: true,
        project_city: true,
        project_country: true,
        source_channel: true,
        next_step: true,
        internal_notes: true,
        project_created_at: true,
        accepted_quote_id: true,
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
          },
        },
        assigned_to_user: { select: { name: true } },
        quote_sends: { select: { sent_at: true }, orderBy: { sent_at: "asc" }, take: 1 },
        quote_families: {
          orderBy: { createdAt: "asc" },
          select: {
            quotes: {
              where: { deletedAt: null },
              orderBy: { version: "asc" },
              select: {
                id: true,
                quote_date: true,
                total_bruto: true,
                won_at: true,
                pdf: { select: { document_name: true } },
              },
            },
          },
        },
        documents: {
          where: { document: { deletedAt: null } },
          select: {
            document: { select: { id: true, document_name: true, filing_category: true, document_system_type: true } },
          },
        },
        channel_events: {
          orderBy: { occurred_at: "desc" },
          take: 8,
          select: {
            id: true,
            channel: true,
            occurred_at: true,
            note: true,
            is_original: true,
            seller: { select: { name: true } },
          },
        },
      },
      orderBy: [{ project_created_at: "desc" }, { createdAt: "desc" }],
    }),
    prismadb.crm_Opportunities.count({ where: waitingWhere }),
    prismadb.crm_Opportunities.findMany({
      where: waitingWhere,
      select: {
        id: true,
        dossier_number: true,
        name: true,
        seller_name: true,
        assigned_account: { select: { name: true } },
        assigned_to_user: { select: { name: true } },
      },
      orderBy: [{ won_at: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
  ]);
  const projects = rows.flatMap((row): ProjectBoardRow[] => {
    if (!row.execution_project_number) return [];
    const documents = row.documents.map((link) => ({
      id: link.document.id,
      name: link.document.document_name,
      category: link.document.filing_category ?? link.document.document_system_type,
    }));
    return [{
      id: row.id,
      projectNumber: row.execution_project_number,
      dossierNumber: row.dossier_number,
      name: row.name,
      status: currentDossierStep({
        hasDocuments: documents.length > 0,
        sentAt: row.quote_sends[0]?.sent_at.toISOString() ?? null,
        status: row.dossier_status,
        projectCreated: true,
        now,
      }),
      seller: row.seller_name ?? row.assigned_to_user?.name ?? null,
      customerId: row.assigned_account?.id ?? null,
      customer: row.assigned_account?.name ?? null,
      email: row.assigned_account?.email ?? null,
      phone: row.assigned_account?.office_phone ?? null,
      mobile: row.assigned_account?.mobile_phone ?? null,
      vat: row.assigned_account?.vat ?? null,
      customerAddress: joinParts([
        row.assigned_account?.billing_street,
        row.assigned_account?.billing_postal_code,
        row.assigned_account?.billing_city,
      ]),
      projectGroup: row.project_group,
      architectName: row.architect_name,
      architectExternalId: row.architect_external_id,
      priceRequestDate: dayString(row.price_request_date),
      requestDate: dayString(row.request_date),
      followUpDate: dayString(row.follow_up_date),
      siteAddress: joinParts([row.project_street, row.project_postal_code, row.project_city, row.project_country]),
      channel: row.source_channel,
      nextStep: row.next_step,
      notes: row.internal_notes,
      createdAt: row.project_created_at?.toISOString() ?? null,
      quotes: row.quote_families.flatMap((family) => family.quotes.map((quote) => ({
        id: quote.id,
        name: quote.pdf.document_name,
        date: dayString(quote.quote_date),
        gross: money(quote.total_bruto),
        won: quote.won_at != null || row.accepted_quote_id === quote.id,
      }))),
      documents,
      followUps: row.channel_events.map((event) => ({
        id: event.id,
        at: dayString(event.occurred_at) ?? "",
        channel: event.channel,
        seller: event.seller.name,
        note: event.note,
        original: event.is_original,
      })),
    }];
  });
  return {
    projectCount: projects.length,
    newThisMonth: projects.filter((row) => row.createdAt != null && row.createdAt >= monthStart).length,
    wonWithoutProjectCount: waitingCount,
    wonWithoutProject: waiting.map((row) => ({
      id: row.id,
      number: row.dossier_number,
      name: row.name,
      customer: row.assigned_account?.name ?? null,
      seller: row.seller_name ?? row.assigned_to_user?.name ?? null,
    })),
    projects,
  };
}

export type ProjectScreenQuote = {
  id: string;
  pdfId: string;
  name: string;
  date: string | null;
  gross: number | null;
  won: boolean;
};

export type ProjectScreenAddress = {
  name: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  vat: string | null;
  vatChoice: string | null;
  role: string | null;
};

/** One project page. New photo fields have no column yet and stay off this object. */
export type ProjectScreenData = {
  id: string;
  projectNumber: string;
  dossierNumber: string | null;
  name: string | null;
  status: string;
  seller: string | null;
  projectLeader: string | null;
  projectGroup: string | null;
  priceRequestDate: string | null;
  customerId: string | null;
  customerName: string | null;
  architectName: string | null;
  architectExternalId: string | null;
  customerAddress: ProjectScreenAddress;
  siteStreet: string | null;
  sitePostalCode: string | null;
  siteCity: string | null;
  siteCountry: string | null;
  /** The customer record stores one address. Billing uses that same street. */
  billingAddress: ProjectScreenAddress;
  projectNotes: string | null;
  nextStep: string | null;
  quotes: ProjectScreenQuote[];
  documents: ProjectDocumentLine[];
  followUps: ProjectFollowUpLine[];
};

export async function getProjectScreen(user: AuthzUser, projectId: string): Promise<ProjectScreenData | null> {
  denyPartner(user);
  const row = await prismadb.crm_Opportunities.findFirst({
    where: {
      id: projectId,
      is_dossier: true,
      execution_project_number: { not: null },
      ...projectReadWhere(user),
    },
    select: {
      id: true,
      execution_project_number: true,
      dossier_number: true,
      name: true,
      dossier_status: true,
      seller_name: true,
      project_leader: true,
      project_group: true,
      architect_name: true,
      architect_external_id: true,
      price_request_date: true,
      request_date: true,
      project_street: true,
      project_postal_code: true,
      project_city: true,
      project_country: true,
      internal_notes: true,
      next_step: true,
      accepted_quote_id: true,
      assigned_account: {
        select: {
          id: true,
          name: true,
          email: true,
          office_phone: true,
          mobile_phone: true,
          vat: true,
          vat_choice: true,
          account_role: true,
          billing_street: true,
          billing_postal_code: true,
          billing_city: true,
          billing_country: true,
        },
      },
      assigned_to_user: { select: { name: true } },
      quote_sends: { select: { sent_at: true }, orderBy: { sent_at: "asc" }, take: 1 },
      quote_families: {
        orderBy: { createdAt: "asc" },
        select: {
          quotes: {
            where: { deletedAt: null },
            orderBy: { version: "asc" },
            select: {
              id: true,
              quote_date: true,
              total_bruto: true,
              won_at: true,
              pdf: { select: { id: true, document_name: true } },
            },
          },
        },
      },
      documents: {
        where: { document: { deletedAt: null } },
        select: {
          document: { select: { id: true, document_name: true, filing_category: true, document_system_type: true } },
        },
      },
      channel_events: {
        orderBy: { occurred_at: "desc" },
        take: 8,
        select: {
          id: true,
          channel: true,
          occurred_at: true,
          note: true,
          is_original: true,
          seller: { select: { name: true } },
        },
      },
    },
  });
  if (!row?.execution_project_number) return null;
  const account = row.assigned_account;
  const customerAddress: ProjectScreenAddress = {
    name: account?.name ?? null,
    street: account?.billing_street ?? null,
    postalCode: account?.billing_postal_code ?? null,
    city: account?.billing_city ?? null,
    country: account?.billing_country ?? null,
    phone: account?.office_phone ?? null,
    mobile: account?.mobile_phone ?? null,
    email: account?.email ?? null,
    vat: account?.vat ?? null,
    vatChoice: account?.vat_choice ?? null,
    role: account?.account_role ?? null,
  };
  const documents = row.documents.map((link) => ({
    id: link.document.id,
    name: link.document.document_name,
    category: link.document.filing_category ?? link.document.document_system_type,
  }));
  return {
    id: row.id,
    projectNumber: row.execution_project_number,
    dossierNumber: row.dossier_number,
    name: row.name,
    status: currentDossierStep({
      hasDocuments: documents.length > 0,
      sentAt: row.quote_sends[0]?.sent_at.toISOString() ?? null,
      status: row.dossier_status,
      projectCreated: true,
    }),
    seller: row.seller_name ?? row.assigned_to_user?.name ?? null,
    projectLeader: row.project_leader,
    projectGroup: row.project_group,
    priceRequestDate: dayString(row.price_request_date) ?? dayString(row.request_date),
    customerId: account?.id ?? null,
    customerName: account?.name ?? null,
    architectName: row.architect_name,
    architectExternalId: row.architect_external_id,
    customerAddress,
    siteStreet: row.project_street,
    sitePostalCode: row.project_postal_code,
    siteCity: row.project_city,
    siteCountry: row.project_country,
    billingAddress: {
      ...customerAddress,
      phone: null,
      mobile: null,
      email: null,
    },
    projectNotes: row.internal_notes,
    nextStep: row.next_step,
    quotes: row.quote_families.flatMap((family) => family.quotes.map((quote) => ({
      id: quote.id,
      pdfId: quote.pdf.id,
      name: quote.pdf.document_name,
      date: dayString(quote.quote_date),
      gross: money(quote.total_bruto),
      won: quote.won_at != null || row.accepted_quote_id === quote.id,
    }))),
    documents,
    followUps: row.channel_events.map((event) => ({
      id: event.id,
      at: dayString(event.occurred_at) ?? "",
      channel: event.channel,
      seller: event.seller.name,
      note: event.note,
      original: event.is_original,
    })),
  };
}

type LockedDossier = {
  id: string;
  dossier_status: string | null;
  execution_project_number: string | null;
};

/**
 * Gives a won dossier its project number. Prices, seller and the other dossier fields stay as they are.
 * A second call returns the number that was already given.
 */
export async function createProjectFromWonDossier(
  user: AuthzUser,
  dossierId: string,
): Promise<{ id: string; number: string; created: boolean }> {
  denyPartner(user);
  const result = await prismadb.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<LockedDossier[]>(Prisma.sql`
      SELECT "id", "dossier_status", "execution_project_number"
      FROM "crm_Opportunities"
      WHERE "id" = ${dossierId}::uuid AND "is_dossier" = true AND "deletedAt" IS NULL
      FOR UPDATE
    `);
    const dossier = locked[0];
    if (!dossier) throw new SalesError("notFound");
    if (!projectCreationAllowed(dossier.dossier_status)) throw new SalesError("projectNotWon");
    if (dossier.execution_project_number) {
      return { id: dossier.id, number: dossier.execution_project_number, created: false };
    }
    const number = await allocateProjectNumber(tx);
    await tx.crm_Opportunities.update({
      where: { id: dossier.id },
      data: {
        execution_project_number: number,
        project_created_at: new Date(),
        updatedBy: user.id,
      },
    });
    return { id: dossier.id, number, created: true };
  });
  if (result.created) {
    await writeAuditLog({
      entityType: "opportunity",
      entityId: result.id,
      action: "updated",
      changes: [{ field: "execution_project_number", old: null, new: result.number }],
      userId: user.id,
    });
  }
  return result;
}
