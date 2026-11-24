import { Prisma } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import type { AuthzUser } from "@/lib/authz/session";
import { sellerNameForUser } from "@/lib/sales/aanvraag-fields";

export const RECENT_OPEN_LIMIT = 5;

export type RecentOpenKind = "ACCOUNT" | "DOSSIER";

export type RecentCustomer = {
  id: string;
  name: string;
};

export type RecentDossier = {
  id: string;
  label: string;
};

export function dossierOpenLabel(number: string | null | undefined, name: string | null | undefined): string {
  const label = [number?.trim(), name?.trim()].filter((part): part is string => Boolean(part)).join(" ");
  return label || "Offertedossier";
}

/** Keep the open order and drop records that no longer exist. */
export function keepOpenOrder<T extends { id: string }>(ids: string[], rows: T[], limit = RECENT_OPEN_LIMIT): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const kept: T[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) continue;
    kept.push(row);
    if (kept.length === limit) break;
  }
  return kept;
}

export async function recordRecentOpen(userId: string, kind: RecentOpenKind, recordId: string): Promise<void> {
  const opened_at = new Date();
  const where = { user_id_kind_record_id: { user_id: userId, kind, record_id: recordId } };
  try {
    await prismadb.crm_RecentOpens.upsert({
      where,
      create: { user_id: userId, kind, record_id: recordId, opened_at },
      update: { opened_at },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await prismadb.crm_RecentOpens.update({ where, data: { opened_at } });
      return;
    }
    throw error;
  }
}

export async function listRecentOpens(user: AuthzUser): Promise<{ customers: RecentCustomer[]; dossiers: RecentDossier[] }> {
  const [accountOpens, dossierOpens] = await Promise.all([
    prismadb.crm_RecentOpens.findMany({
      where: { user_id: user.id, kind: "ACCOUNT" },
      orderBy: { opened_at: "desc" },
      take: RECENT_OPEN_LIMIT * 3,
      select: { record_id: true },
    }),
    prismadb.crm_RecentOpens.findMany({
      where: { user_id: user.id, kind: "DOSSIER" },
      orderBy: { opened_at: "desc" },
      take: RECENT_OPEN_LIMIT * 3,
      select: { record_id: true },
    }),
  ]);

  const accountIds = accountOpens.map((row) => row.record_id);
  const dossierIds = dossierOpens.map((row) => row.record_id);
  const ownSeller = sellerNameForUser(user);

  const [accounts, dossiers] = await Promise.all([
    accountIds.length === 0
      ? []
      : prismadb.crm_Accounts.findMany({
          where: { id: { in: accountIds }, deletedAt: null },
          select: { id: true, name: true },
        }),
    dossierIds.length === 0
      ? []
      : prismadb.crm_Opportunities.findMany({
          where: {
            id: { in: dossierIds },
            is_dossier: true,
            deletedAt: null,
            ...(ownSeller ? { seller_name: ownSeller } : {}),
          },
          select: { id: true, dossier_number: true, name: true },
        }),
  ]);

  return {
    customers: keepOpenOrder(accountIds, accounts).map((account) => ({
      id: account.id,
      name: account.name,
    })),
    dossiers: keepOpenOrder(dossierIds, dossiers).map((dossier) => ({
      id: dossier.id,
      label: dossierOpenLabel(dossier.dossier_number, dossier.name),
    })),
  };
}
