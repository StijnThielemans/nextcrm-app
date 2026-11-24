import { isSellerName, sellerNameForUser, type SellerName } from "./aanvraag-fields";
import { euro } from "./labels";
import { wonQuotesTotal } from "./quote-choice";
import { chartBuckets, instantDate, type DateRange, type PeriodPreset } from "./dashboard-period";

/** Stored total_bruto. Inclusive of VAT. Never a converted sell price. */
export const DASHBOARD_AMOUNT_LABEL = "Totaal bruto (incl. btw)";

export type DashQuote = {
  id: string;
  familyId: string;
  version: number;
  number: string;
  /** Stored total_bruto. Null when the quote has no gross total. */
  bruto: number | null;
  wonAt: string | null;
  accepted: boolean;
  createdAt: string;
};

export type DashDossier = {
  id: string;
  number: string | null;
  status: string;
  seller: string | null;
  customer: string | null;
  city: string | null;
  postalCode: string | null;
  requestDate: string | null;
  wonAt: string | null;
  lostAt: string | null;
  quotes: DashQuote[];
  sends: { quoteId: string; sentAt: string }[];
};

export type AmountStat = {
  amount: number | null;
  count: number;
  unpriced: number;
  previousAmount: number | null;
  previousCount: number;
  /** Relative change of the amount. Null when the previous amount is missing or zero. */
  delta: number | null;
};

export type CountStat = {
  count: number;
  previousCount: number;
  delta: number | null;
};

export type SalesDashboardModel = {
  preset: PeriodPreset;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  canSeeOthers: boolean;
  amountLabel: typeof DASHBOARD_AMOUNT_LABEL;
  sold: AmountStat;
  open: AmountStat;
  won: CountStat;
  conversion: {
    percent: number | null;
    won: number;
    lost: number;
    closed: number;
    previousPercent: number | null;
    previousClosed: number;
  };
  average: {
    amount: number | null;
    priced: number;
    previousAmount: number | null;
    previousPriced: number;
    delta: number | null;
  };
  fresh: AmountStat;
  chart: { points: { label: string; amount: number }[]; empty: boolean };
  ranking: { rows: { seller: string; amount: number; dossiers: number }[]; empty: string | null };
  wonLost: {
    wonCount: number;
    lostCount: number;
    wonAmount: number | null;
    lostAmount: number | null;
    wonUnpriced: number;
    lostUnpriced: number;
  };
  momentum: string[];
  record: { amount: number; number: string | null; date: string | null; customer: string | null } | null;
  recordEmpty: string | null;
  bars: {
    rows: { seller: string; amount: number }[];
    mode: "compare" | "self" | "empty";
    empty: string | null;
  };
  region: { rows: { label: string; count: number; wonAmount: number | null }[]; empty: string | null };
  followUp: {
    id: string;
    customer: string;
    number: string;
    amount: number | null;
    date: string;
    daysOpen: number;
    seller: string | null;
    notes: string[];
  }[];
};

type Viewer = { name?: string | null; role?: string | null };

/** Admin and manager see every seller. A seller, and anyone else, does not get a colleague filter. */
export function canSeeOtherSellers(user: Viewer): boolean {
  return !sellerNameForUser(user) && (user.role === "admin" || user.role === "manager");
}

/** Ignore a seller query unless this login may see more than themselves. `geen` is dossiers without a seller. */
export function sellerFilterParam(user: Viewer, raw: string | undefined): SellerName | "none" | null {
  if (!canSeeOtherSellers(user)) return null;
  if (raw === "geen") return "none";
  if (raw && isSellerName(raw)) return raw;
  return null;
}

function inRange(day: string | null, range: DateRange): boolean {
  return day != null && day >= range.start && day <= range.end;
}

function latestSend(dossier: DashDossier): { quote: DashQuote; sentAt: string } | null {
  const ordered = [...dossier.sends].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const send = ordered[index];
    const quote = dossier.quotes.find((item) => item.id === send.quoteId);
    if (quote) return { quote, sentAt: send.sentAt };
  }
  return null;
}

/** The quote the dossier already treats as current: the latest send, otherwise the newest family's current version. */
function relevantQuote(dossier: DashDossier): DashQuote | null {
  const sent = latestSend(dossier);
  if (sent) return sent.quote;
  if (dossier.quotes.length === 0) return null;
  const newest = [...dossier.quotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.version - a.version)[0];
  const family = dossier.quotes.filter((quote) => quote.familyId === newest.familyId);
  return family.reduce((best, quote) => (quote.version > best.version ? quote : best));
}

function markedWon(dossier: DashDossier): DashQuote[] {
  return dossier.quotes.filter((quote) => quote.accepted || quote.wonAt != null);
}

/** Header total: every quote marked won, added up. Other versions and alternatives stay out. */
function wonAmount(dossier: DashDossier): number | null {
  return wonQuotesTotal(markedWon(dossier).map((quote) => quote.bruto));
}

function lostAmount(dossier: DashDossier): number | null {
  const marked = wonAmount(dossier);
  if (marked != null) return marked;
  return relevantQuote(dossier)?.bruto ?? null;
}

function isWon(dossier: DashDossier): boolean {
  return dossier.status === "GEWONNEN";
}

function isLost(dossier: DashDossier): boolean {
  return dossier.status === "VERLOREN";
}

function isOpen(dossier: DashDossier): boolean {
  return !isWon(dossier) && !isLost(dossier);
}

type MoneyRow = { amount: number | null };

function sumMoney(rows: MoneyRow[]): { amount: number | null; count: number; unpriced: number } {
  let cents = 0;
  let priced = 0;
  let unpriced = 0;
  for (const row of rows) {
    if (row.amount == null || !Number.isFinite(row.amount)) {
      unpriced += 1;
      continue;
    }
    priced += 1;
    cents += Math.round(row.amount * 100);
  }
  return { amount: priced === 0 ? null : cents / 100, count: rows.length, unpriced };
}

function averageOf(amount: number | null, priced: number): number | null {
  if (amount == null || priced <= 0) return null;
  return Math.round(Math.round(amount * 100) / priced) / 100;
}

function relativeDelta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function countDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function rate(won: number, lost: number): number | null {
  const closed = won + lost;
  if (closed === 0) return null;
  return Math.round((won / closed) * 1000) / 10;
}

function pct(value: number): string {
  return `${new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 1 }).format(value)} %`;
}

function sellerLabel(name: string | null): string {
  const text = name?.trim() ?? "";
  return text || "Geen verkoper";
}

function regionLabel(dossier: DashDossier): string | null {
  const city = dossier.city?.trim() ?? "";
  if (city) return city;
  const postal = dossier.postalCode?.trim() ?? "";
  if (postal) return `Postcode ${postal}`;
  return null;
}

function median(values: number[]): number | null {
  if (values.length < 3) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

function daysBetween(start: string, end: string): number {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000);
}

type WonRow = { seller: string; amount: number | null; day: string | null; dossier: DashDossier };

function wonRows(dossiers: DashDossier[], range: DateRange): WonRow[] {
  const rows: WonRow[] = [];
  for (const dossier of dossiers) {
    if (!isWon(dossier)) continue;
    const day = instantDate(dossier.wonAt);
    if (!inRange(day, range)) continue;
    rows.push({ seller: sellerLabel(dossier.seller), amount: wonAmount(dossier), day, dossier });
  }
  return rows;
}

function lostRows(dossiers: DashDossier[], range: DateRange): { amount: number | null }[] {
  const rows: { amount: number | null }[] = [];
  for (const dossier of dossiers) {
    if (!isLost(dossier)) continue;
    const day = instantDate(dossier.lostAt);
    if (!inRange(day, range)) continue;
    rows.push({ amount: lostAmount(dossier) });
  }
  return rows;
}

function openRows(dossiers: DashDossier[], range: DateRange): MoneyRow[] {
  const rows: MoneyRow[] = [];
  for (const dossier of dossiers) {
    if (!isOpen(dossier)) continue;
    const sent = latestSend(dossier);
    if (!sent) continue;
    if (!inRange(instantDate(sent.sentAt), range)) continue;
    rows.push({ amount: sent.quote.bruto });
  }
  return rows;
}

function freshRows(dossiers: DashDossier[], range: DateRange): MoneyRow[] {
  const rows: MoneyRow[] = [];
  for (const dossier of dossiers) {
    const quote = relevantQuote(dossier);
    if (!quote) continue;
    if (!inRange(instantDate(quote.createdAt), range)) continue;
    rows.push({ amount: quote.bruto });
  }
  return rows;
}

function amountStat(current: MoneyRow[], previous: MoneyRow[]): AmountStat {
  const now = sumMoney(current);
  const before = sumMoney(previous);
  return {
    amount: now.amount,
    count: now.count,
    unpriced: now.unpriced,
    previousAmount: before.amount,
    previousCount: before.count,
    delta: relativeDelta(now.amount, before.amount),
  };
}

function sellerAmounts(rows: WonRow[]): { seller: string; amount: number; dossiers: number }[] {
  const bySeller = new Map<string, { cents: number; priced: number; dossiers: number }>();
  for (const row of rows) {
    const current = bySeller.get(row.seller) ?? { cents: 0, priced: 0, dossiers: 0 };
    current.dossiers += 1;
    if (row.amount != null) {
      current.priced += 1;
      current.cents += Math.round(row.amount * 100);
    }
    bySeller.set(row.seller, current);
  }
  const ranked: { seller: string; amount: number; dossiers: number }[] = [];
  bySeller.forEach((value, seller) => {
    if (value.priced > 0) ranked.push({ seller, amount: value.cents / 100, dossiers: value.dossiers });
  });
  return ranked.sort((a, b) => b.amount - a.amount || b.dossiers - a.dossiers || a.seller.localeCompare(b.seller, "nl"));
}

export function buildSalesDashboard(input: {
  dossiers: DashDossier[];
  preset: PeriodPreset;
  range: DateRange;
  previous: DateRange;
  today: string;
  canSeeOthers: boolean;
}): SalesDashboardModel {
  const { dossiers, range, previous, today, canSeeOthers } = input;
  const won = wonRows(dossiers, range);
  const wonBefore = wonRows(dossiers, previous);
  const lost = lostRows(dossiers, range);
  const lostBefore = lostRows(dossiers, previous);
  const sold = amountStat(won, wonBefore);
  const open = amountStat(openRows(dossiers, range), openRows(dossiers, previous));
  const fresh = amountStat(freshRows(dossiers, range), freshRows(dossiers, previous));
  const wonCount: CountStat = {
    count: won.length,
    previousCount: wonBefore.length,
    delta: countDelta(won.length, wonBefore.length),
  };
  const lostSum = sumMoney(lost);
  const conversionPercent = rate(won.length, lost.length);
  const previousPercent = rate(wonBefore.length, lostBefore.length);
  const soldPriced = sold.count - sold.unpriced;
  const soldPricedBefore = sold.previousCount - (wonBefore.filter((row) => row.amount == null).length);
  const averageAmount = averageOf(sold.amount, soldPriced);
  const previousAverage = averageOf(sold.previousAmount, soldPricedBefore);

  const buckets = chartBuckets(range);
  const points = buckets.map((bucket) => {
    const rows = won.filter((row) => row.day != null && row.day >= bucket.start && row.day <= bucket.end);
    return { label: bucket.label, amount: sumMoney(rows).amount ?? 0 };
  });
  const chartEmpty = points.every((point) => point.amount === 0);

  const ranked = sellerAmounts(won).map((row) => ({ ...row }));
  const ranking = canSeeOthers
    ? {
        rows: ranked.slice(0, 3).map((row) => ({ ...row })),
        empty: ranked.length === 0 ? "Geen gewonnen omzet om verkopers te rangschikken." : null,
      }
    : {
        rows: [],
        empty: "Je ziet alleen je eigen cijfers. Er is geen rangschikking van andere verkopers.",
      };

  const bars = !canSeeOthers
    ? ranked.length === 0
      ? { rows: [], mode: "empty" as const, empty: "Geen gewonnen omzet in deze periode. Cijfers van andere verkopers staan hier niet." }
      : { rows: ranked.map((row) => ({ ...row })), mode: "self" as const, empty: null }
    : ranked.length === 0
      ? { rows: [], mode: "empty" as const, empty: "Geen gewonnen omzet per verkoper in deze periode." }
      : { rows: ranked.map((row) => ({ ...row })), mode: "compare" as const, empty: null };

  const pricedWins = dossiers
    .filter((dossier) => isWon(dossier))
    .map((dossier) => ({ dossier, amount: wonAmount(dossier), date: instantDate(dossier.wonAt) }))
    .filter((row): row is { dossier: DashDossier; amount: number; date: string | null } => row.amount != null);
  const record =
    pricedWins.length < 2
      ? null
      : pricedWins.reduce((best, row) => (row.amount > best.amount ? row : best));

  const requested = dossiers.filter((dossier) => inRange(dossier.requestDate, range));
  const located = new Map<string, DashDossier[]>();
  let withoutPlace = 0;
  for (const dossier of requested) {
    const label = regionLabel(dossier);
    if (!label) {
      withoutPlace += 1;
      continue;
    }
    located.set(label, [...(located.get(label) ?? []), dossier]);
  }
  const regionRows: { label: string; count: number; wonAmount: number | null }[] = [];
  located.forEach((group, label) => {
    regionRows.push({
      label,
      count: group.length,
      wonAmount: sumMoney(group.filter(isWon).map((dossier) => ({ amount: wonAmount(dossier) }))).amount,
    });
  });
  regionRows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "nl"));
  if (withoutPlace > 0 && regionRows.length > 0) {
    const blank = requested.filter((dossier) => regionLabel(dossier) == null);
    regionRows.push({
      label: "Zonder plaats",
      count: withoutPlace,
      wonAmount: sumMoney(blank.filter(isWon).map((dossier) => ({ amount: wonAmount(dossier) }))).amount,
    });
  }
  const region =
    requested.length === 0
      ? { rows: [], empty: "Geen dossiers met een aanvraagdatum in deze periode." }
      : regionRows.length === 0
        ? { rows: [], empty: "Geen plaats of postcode op de dossiers in deze periode." }
        : { rows: regionRows, empty: null };

  const followSources = dossiers
    .filter(isOpen)
    .map((dossier) => {
      const sent = latestSend(dossier);
      if (!sent) return null;
      const date = instantDate(sent.sentAt);
      if (!date) return null;
      return { dossier, quote: sent.quote, date, daysOpen: Math.max(0, daysBetween(date, today)) };
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => b.daysOpen - a.daysOpen || (b.quote.bruto ?? 0) - (a.quote.bruto ?? 0));
  const openMedian = median(followSources.flatMap((row) => (row.quote.bruto == null ? [] : [row.quote.bruto])));
  const followUp = followSources.map((row) => {
    const notes: string[] = [];
    if (row.daysOpen > 7) notes.push("Langer dan 7 dagen open.");
    if (openMedian != null && row.quote.bruto != null && row.quote.bruto > openMedian) {
      notes.push(`Hoger dan de mediaan van deze open offertes (${euro(openMedian)}).`);
    }
    return {
      id: row.dossier.id,
      customer: row.dossier.customer?.trim() || "—",
      number: row.quote.number,
      amount: row.quote.bruto,
      date: row.date,
      daysOpen: row.daysOpen,
      seller: row.dossier.seller,
      notes,
    };
  });

  const momentum: string[] = [];
  if (sold.amount != null) {
    let line = `Gewonnen omzet: ${euro(sold.amount)}.`;
    if (sold.previousAmount != null) line += ` Vorige periode: ${euro(sold.previousAmount)}.`;
    momentum.push(line);
  } else if (sold.count > 0) {
    momentum.push(`${sold.count} gewonnen ${sold.count === 1 ? "dossier" : "dossiers"} zonder totaal bruto.`);
  }
  if (won.length > 0 || lost.length > 0) {
    const word = (count: number) => (count === 1 ? "dossier" : "dossiers");
    momentum.push(`${won.length} gewonnen ${word(won.length)} en ${lost.length} verloren ${word(lost.length)}.`);
  }
  if (conversionPercent != null) {
    momentum.push(`Conversie ${pct(conversionPercent)} op ${won.length + lost.length} afgesloten dossiers.`);
  }
  if (open.count > 0) {
    momentum.push(
      open.amount != null
        ? `${open.count} open ${open.count === 1 ? "offerte" : "offertes"}, samen ${euro(open.amount)}.`
        : `${open.count} open ${open.count === 1 ? "offerte" : "offertes"} zonder totaal bruto.`,
    );
  }
  if (momentum.length === 0) momentum.push("Geen cijfers in deze periode.");

  return {
    preset: input.preset,
    start: range.start,
    end: range.end,
    previousStart: previous.start,
    previousEnd: previous.end,
    canSeeOthers,
    amountLabel: DASHBOARD_AMOUNT_LABEL,
    sold,
    open,
    won: wonCount,
    conversion: {
      percent: conversionPercent,
      won: won.length,
      lost: lost.length,
      closed: won.length + lost.length,
      previousPercent,
      previousClosed: wonBefore.length + lostBefore.length,
    },
    average: {
      amount: averageAmount,
      priced: soldPriced,
      previousAmount: previousAverage,
      previousPriced: soldPricedBefore,
      delta: relativeDelta(averageAmount, previousAverage),
    },
    fresh,
    chart: { points: chartEmpty ? [] : points, empty: chartEmpty },
    ranking,
    wonLost: {
      wonCount: won.length,
      lostCount: lost.length,
      wonAmount: sold.amount,
      lostAmount: lostSum.amount,
      wonUnpriced: sold.unpriced,
      lostUnpriced: lostSum.unpriced,
    },
    momentum: momentum.slice(0, 4),
    record: record
      ? { amount: record.amount, number: record.dossier.number, date: record.date, customer: record.dossier.customer }
      : null,
    recordEmpty: record ? null : "Te weinig gewonnen dossiers met een totaal bruto om een record te bepalen.",
    bars,
    region,
    followUp,
  };
}
