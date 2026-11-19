"use server";

import { prismadb } from "@/lib/prisma";
import { requireAuthenticated, AuthenticationError } from "@/lib/authz";

export async function listCustomerTaxRates(): Promise<{ id: string; name: string; rate: number }[]> {
  try {
    await requireAuthenticated({ partner: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return [];
    throw error;
  }
  const rows = await prismadb.invoice_TaxRates.findMany({
    where: { active: true },
    orderBy: [{ isDefault: "desc" }, { rate: "desc" }],
    select: { id: true, name: true, rate: true },
  });
  return rows.map((row) => ({ id: row.id, name: row.name, rate: Number(row.rate) }));
}
