import { Prisma } from "@prisma/client";
import { SalesError } from "./errors";

const Decimal = Prisma.Decimal;
const MAX = new Decimal("999999999999.99");

/**
 * Belgian money: 2.782,09 or 2782,09. A dot-decimal 2782.09 is accepted when
 * it comes from this parser or from someone typing a point.
 */
const AMOUNT = /(\d{1,3}(?:[.\u00A0\u202F ]\d{3})+|\d+),(\d{2})(?!\d)/g;

/** Gross-total labels, most specific first. Net totals are intentionally absent. */
const GROSS_LABELS = [
  /totaal\s*bruto|bruto[\s-]*totaal/gi,
  /totaal\s*(?:\(\s*)?incl(?:usief|\.?)?\s*btw/gi,
  /eindtotaal|totaal\s+te\s+betalen/gi,
];

function safeParse(raw: string): string | null {
  try {
    return parseGrossTotalInput(raw);
  } catch {
    return null;
  }
}

function amountsIn(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(AMOUNT)) {
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 4);
    if (after.trimStart().startsWith("%")) continue;
    const canonical = safeParse(`${match[1]},${match[2]}`);
    if (canonical) found.push(canonical);
  }
  return found;
}

function amountNear(text: string, start: number, end: number): string | null {
  const after = text.slice(end, end + 80).split("\n").slice(0, 2).join("\n");
  const afterHit = amountsIn(after)[0];
  if (afterHit) return afterHit;
  const before = text.slice(Math.max(0, start - 40), start);
  const beforeHits = amountsIn(before);
  return beforeHits[beforeHits.length - 1] ?? null;
}

/** Canonical "2782.09", or null when the PDF text has no gross-total label. */
export function extractGrossTotal(text: string): string | null {
  const normalized = text.replace(/\u00a0/g, " ");
  for (const label of GROSS_LABELS) {
    label.lastIndex = 0;
    const hits: string[] = [];
    for (const match of normalized.matchAll(new RegExp(label.source, label.flags))) {
      if (match.index == null) continue;
      const amount = amountNear(normalized, match.index, match.index + match[0].length);
      if (amount) hits.push(amount);
    }
    if (hits.length > 0) return hits[hits.length - 1];
  }
  return null;
}

/** A typed or extracted total. Empty input is a missing price, not a zero. */
export function parseGrossTotalInput(raw: string): string {
  const compact = raw.replace(/€/g, "").replace(/eur/gi, "").replace(/[\s\u00A0\u202F]/g, "");
  if (!compact) throw new SalesError("priceRequired");
  if (compact.startsWith("-")) throw new SalesError("negativeMoney");
  const unsigned = compact.replace(/^\+/, "");

  let canonical: string;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(unsigned) || /^\d+(?:,\d{1,2})$/.test(unsigned)) {
    const [whole, frac = ""] = unsigned.split(",");
    canonical = `${whole.replace(/\./g, "")}.${frac.padEnd(2, "0")}`;
  } else if (/^\d+(?:\.\d{1,2})?$/.test(unsigned)) {
    const [whole, frac = ""] = unsigned.split(".");
    canonical = `${whole}.${(frac ?? "").padEnd(2, "0")}`;
  } else {
    throw new SalesError("invalidAmount");
  }

  const value = new Decimal(canonical);
  if (value.gt(MAX)) throw new SalesError("invalidAmount");
  return value.toFixed(2);
}
