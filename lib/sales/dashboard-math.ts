import { FOLLOW_UP_STATUSES } from "./labels";

export type LatestSend = { sentAt: string; sell: number; margin: number };

/** De nieuwste verzending. Alternatieven die niet verstuurd zijn, tellen niet mee. */
export function pickLatestSend(sends: LatestSend[]): LatestSend | null {
  let best: LatestSend | null = null;
  for (const send of sends) {
    if (!best || send.sentAt > best.sentAt) best = send;
  }
  return best;
}

export type DashRow = {
  status: string;
  step: string;
  requestDate: string | null;
  followUpDate: string | null;
  wonAt: string | null;
  lostAt: string | null;
  acceptedSell: number | null;
  acceptedMargin: number | null;
  latestSentSell: number | null;
  latestSentMargin: number | null;
};

export type SalesTiles = {
  openCount: number;
  byStatus: Record<string, number>;
  followUpCount: number;
  newThisMonth: number;
  wonCount: number;
  lostCount: number;
  openSell: number;
  openMargin: number;
  openMarginPercent: number | null;
  wonSell: number;
  wonMargin: number;
  lostSell: number;
};

function inRange(value: string | null, start: string, end: string): boolean {
  if (!value) return false;
  return value >= start && value < end;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Som van de laatst verstuurde versie per dossier. Verkoop 0 geeft een leeg procent. */
export function salesTiles(rows: DashRow[], monthStart: string, monthEnd: string, today: string): SalesTiles {
  const byStatus: Record<string, number> = {};
  let openCount = 0;
  let followUpCount = 0;
  let newThisMonth = 0;
  let wonCount = 0;
  let lostCount = 0;
  let openSell = 0;
  let openMargin = 0;
  let wonSell = 0;
  let wonMargin = 0;
  let lostSell = 0;

  for (const row of rows) {
    byStatus[row.step] = (byStatus[row.step] ?? 0) + 1;
    const open = row.status !== "GEWONNEN" && row.status !== "VERLOREN";
    if (open) openCount += 1;
    if (open && row.latestSentSell != null) {
      openSell += row.latestSentSell;
      openMargin += row.latestSentMargin ?? 0;
    }
    if (
      FOLLOW_UP_STATUSES.includes(row.status as (typeof FOLLOW_UP_STATUSES)[number]) &&
      row.followUpDate != null &&
      row.followUpDate <= today
    ) {
      followUpCount += 1;
    }
    if (inRange(row.requestDate, monthStart, monthEnd)) newThisMonth += 1;
    if (inRange(row.wonAt, monthStart, monthEnd)) {
      wonCount += 1;
      wonSell += row.acceptedSell ?? 0;
      wonMargin += row.acceptedMargin ?? 0;
    }
    if (inRange(row.lostAt, monthStart, monthEnd)) {
      lostCount += 1;
      lostSell += row.latestSentSell ?? 0;
    }
  }

  return {
    openCount,
    byStatus,
    followUpCount,
    newThisMonth,
    wonCount,
    lostCount,
    openSell: round2(openSell),
    openMargin: round2(openMargin),
    openMarginPercent: openSell === 0 ? null : round2((openMargin / openSell) * 100),
    wonSell: round2(wonSell),
    wonMargin: round2(wonMargin),
    lostSell: round2(lostSell),
  };
}
