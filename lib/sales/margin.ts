import { Prisma } from "@prisma/client";
import { SalesError } from "./errors";

const Decimal = Prisma.Decimal;

export type QuoteMargin = {
  cost: Prisma.Decimal;
  sell: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  marginEuro: Prisma.Decimal;
  marginPercent: Prisma.Decimal | null;
};

/** Marge = verkoop − kost. Procent = marge / verkoop × 100. Verkoop 0 geeft geen procent. */
export function quoteMargin(costRaw: string, sellRaw: string, vatRaw: string): QuoteMargin {
  let cost: Prisma.Decimal;
  let sell: Prisma.Decimal;
  let vatRate: Prisma.Decimal;
  try {
    cost = new Decimal(costRaw);
    sell = new Decimal(sellRaw);
    vatRate = new Decimal(vatRaw);
  } catch {
    throw new SalesError("invalidAmount");
  }
  if (cost.isNeg() || sell.isNeg()) throw new SalesError("negativeMoney");
  if (vatRate.isNeg() || vatRate.gt(100)) throw new SalesError("vatRange");

  const costFixed = cost.toDecimalPlaces(2);
  const sellFixed = sell.toDecimalPlaces(2);
  const vatFixed = vatRate.toDecimalPlaces(2);
  const marginEuro = sellFixed.minus(costFixed).toDecimalPlaces(2);
  const marginPercent = sellFixed.isZero()
    ? null
    : marginEuro.div(sellFixed).mul(100).toDecimalPlaces(2);

  return { cost: costFixed, sell: sellFixed, vatRate: vatFixed, marginEuro, marginPercent };
}
