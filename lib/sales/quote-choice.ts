import { euro } from "./labels";

/** Shown when a quote has no stored totaal bruto. Never a made-up amount. */
export const MISSING_QUOTE_PRICE = "geen prijs";

export function quotePriceLabel(gross: number | null): string {
  if (gross == null || !Number.isFinite(gross)) return MISSING_QUOTE_PRICE;
  return euro(gross);
}

/** A winner needs a stored totaal bruto. Null is missing, not zero. */
export function quoteCanWin(gross: number | null): boolean {
  return gross != null && Number.isFinite(gross);
}

/** Header amount: the stored totaal bruto of every won quote, added up. No won price means no total. */
export function wonQuotesTotal(grosses: readonly (number | null | undefined)[]): number | null {
  const cents = grosses.reduce((sum, gross) => {
    if (gross == null || !Number.isFinite(gross)) return sum;
    return sum + Math.round(gross * 100);
  }, 0);
  const priced = grosses.some((gross) => gross != null && Number.isFinite(gross));
  return priced ? cents / 100 : null;
}
