import { euro, statusLabel } from "@/lib/sales/labels";
import type { OfferteSearchRow } from "@/lib/sales/offerte-list";

export type { OfferteSearchRow };

export const MISSING_OFFERTE_PRICE = "geen prijs";

export function offertePriceLabel(gross: number | null): string {
  if (gross == null || !Number.isFinite(gross)) return MISSING_OFFERTE_PRICE;
  return euro(gross);
}

function text(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function offerteStatusText(status: string | null | undefined) {
  const label = statusLabel(status);
  return label === "—" ? "" : label;
}

export function offerteWonText(won: boolean) {
  return won ? "Gewonnen" : "";
}

function priceNeedles(gross: number | null) {
  if (gross == null || !Number.isFinite(gross)) return MISSING_OFFERTE_PRICE;
  const plain = String(gross);
  return `${offertePriceLabel(gross)} ${plain} ${plain.replace(".", ",")}`;
}

/** One box matches every column on the Offertes tab. */
export function offerteMatchesSearch(row: OfferteSearchRow, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    row.name,
    row.number,
    priceNeedles(row.gross),
    row.date,
    row.sentAt,
    row.dossierNumber,
    row.dossierName,
    row.customer,
    row.seller,
    offerteStatusText(row.status),
    offerteWonText(row.won),
  ]
    .map((value) => text(value))
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}
