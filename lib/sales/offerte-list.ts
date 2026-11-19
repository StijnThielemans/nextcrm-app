import { prismadb } from "@/lib/prisma";
import type { AuthzUser } from "@/lib/authz/session";
import { opportunityReadScopeWhere } from "@/lib/authz/scopes/crm";
import { SalesError } from "./errors";

export type OfferteSearchRow = {
  id: string;
  pdfId: string;
  name: string;
  number: string;
  gross: number | null;
  date: string;
  sentAt: string | null;
  dossierId: string;
  dossierNumber: string | null;
  dossierName: string | null;
  customer: string | null;
  seller: string | null;
  status: string | null;
  won: boolean;
};

function denyPartner(user: AuthzUser) {
  if (user.role === "partner") throw new SalesError("forbidden");
}

function dayString(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function money(value: { toNumber?: () => number } | number | null | undefined): number | null {
  if (value == null) return null;
  const amount = typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/** Totaal bruto when the PDF stored one. Older configurator rows keep their verkoopprijs. */
export function offerteGross(bruto: { toNumber?: () => number } | number | null | undefined, sell: { toNumber?: () => number } | number | null | undefined): number | null {
  const gross = money(bruto);
  if (gross != null) return gross;
  const legacy = money(sell);
  if (legacy != null && legacy !== 0) return legacy;
  return null;
}

export async function listOfferteOverview(user: AuthzUser): Promise<OfferteSearchRow[]> {
  denyPartner(user);
  const rows = await prismadb.crm_ExternalQuotes.findMany({
    where: {
      deletedAt: null,
      family: { dossier: { is_dossier: true, ...opportunityReadScopeWhere(user) } },
    },
    include: {
      pdf: { select: { id: true, document_name: true } },
      sends: { orderBy: { sent_at: "desc" }, take: 1, select: { sent_at: true } },
      family: {
        select: {
          dossier: {
            select: {
              id: true,
              dossier_number: true,
              name: true,
              dossier_status: true,
              seller_name: true,
              accepted_quote_id: true,
              assigned_account: { select: { name: true } },
              assigned_to_user: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => {
    const dossier = row.family.dossier;
    const name = row.pdf.document_name?.trim() || row.quote_number;
    return {
      id: row.id,
      pdfId: row.pdf.id,
      name,
      number: row.quote_number,
      gross: offerteGross(row.total_bruto, row.sell_excl_vat),
      date: dayString(row.quote_date) ?? "",
      sentAt: dayString(row.sends[0]?.sent_at),
      dossierId: dossier.id,
      dossierNumber: dossier.dossier_number,
      dossierName: dossier.name,
      customer: dossier.assigned_account?.name ?? null,
      seller: dossier.seller_name ?? dossier.assigned_to_user?.name ?? null,
      status: dossier.dossier_status,
      won: dossier.accepted_quote_id === row.id,
    };
  });
}
