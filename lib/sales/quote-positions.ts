import { parseGrossTotalInput } from "./gross-total";

/** One text run in PDF user space. y is the baseline, origin bottom-left. */
export type PdfTextRun = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** An embedded image that is not the full-page letterhead. */
export type PdfImageBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type QuotePage = {
  pageNumber: number;
  width: number;
  height: number;
  items: PdfTextRun[];
  images: PdfImageBox[];
};

/** Crop rectangle in PDF points. y is the bottom edge. */
export type QuoteCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** What the dossier shows. The crop stays on the server. */
export type QuotePositionView = {
  id: string;
  pageNumber: number;
  number: string;
  title: string;
  quantity: string | null;
  price: number | null;
  text: string;
};

export type QuotePositionBlock = {
  id: string;
  pageNumber: number;
  /** Position number, or the label in that column when it is not numeric. */
  number: string;
  title: string;
  /** As printed, for example "1,00 stuk(s)". Null when the line has none. */
  quantity: string | null;
  /** Rightmost amount on the position line. Null when the PDF has no price. */
  price: number | null;
  /** Specification lines under the position heading, for when the crop cannot be shown. */
  text: string;
  crop: QuoteCrop;
};

const PRICE = /^(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/;
const QUANTITY = /^(\d+(?:[.,]\d+)?)\s+(stuk\(s\)|stuks|stuk|st\.)\s*/i;
const STOP = /^(?:Overdracht|Offerte-Nr|Alternatief aanbod-Nr|Totaal netto|Totaal bruto|\+\s*BTW|Betalingsvoorwaarden)/i;
const COLUMN_HEADER = /^(?:Positie|Hoeveelheid|Omschrijving|EP|EUR|Totaalprijs)$/i;

function priceToken(text: string): string | null {
  const clean = text.replace(/€/g, "").replace(/\s+/g, "").trim();
  return PRICE.test(clean) ? clean : null;
}

function priceNumber(text: string): number | null {
  try {
    const value = Number(parseGrossTotalInput(text));
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function sameLine(a: number, b: number): boolean {
  return Math.abs(a - b) < 1.6;
}

function linesOf(items: PdfTextRun[]): PdfTextRun[][] {
  const sorted = [...items].filter((item) => item.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfTextRun[][] = [];
  for (const item of sorted) {
    const line = lines.find((existing) => sameLine(existing[0].y, item.y));
    if (line) line.push(item);
    else lines.push([item]);
  }
  for (const line of lines) line.sort((a, b) => a.x - b.x);
  return lines;
}

function joinText(items: PdfTextRun[]): string {
  return items.map((item) => item.text.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

type Header = {
  y: number;
  number: string;
  title: string;
  quantity: string | null;
  price: number | null;
  items: PdfTextRun[];
};

function headerFrom(line: PdfTextRun[]): Header | null {
  const prices = line.filter((item) => item.x > 360 && priceToken(item.text));
  const left = line.filter((item) => item.x < 110 && !prices.includes(item));
  const number = joinText(left);
  if (!number || number.length > 40 || COLUMN_HEADER.test(number)) return null;
  const middle = line.filter((item) => item.x >= 110 && item.x < 400 && !prices.includes(item));
  const middleText = joinText(middle);
  const quantityMatch = middleText.match(QUANTITY);
  if (!quantityMatch) return null;
  const quantity = quantityMatch[0].trim();
  const title = middleText.slice(quantityMatch[0].length).trim() || number;
  const priceText = prices.sort((a, b) => a.x - b.x).at(-1);
  return {
    y: line[0].y,
    number,
    title,
    quantity,
    price: priceText ? priceNumber(priceToken(priceText.text) ?? "") : null,
    items: line,
  };
}

function imageInBand(image: PdfImageBox, headerY: number, boundaryY: number, pageWidth: number): boolean {
  if (image.width > pageWidth * 0.45 || image.height > pageWidth) return false;
  if (image.width < 15 || image.height < 15) return false;
  const top = image.y + image.height;
  return top < headerY + 14 && top > boundaryY + 4 && image.y > boundaryY - 2;
}

export function newestQuotePdf<T extends { pdfId: string; date?: string | null; addedAt?: string | null }>(quotes: T[]): T | null {
  const unique: T[] = [];
  for (const quote of quotes) {
    const index = unique.findIndex((item) => item.pdfId === quote.pdfId);
    if (index === -1) unique.push(quote);
    else if ((quote.addedAt || "") > (unique[index].addedAt || "")) unique[index] = quote;
  }
  unique.sort((left, right) => {
    const byDate = (right.date || "").localeCompare(left.date || "");
    if (byDate !== 0) return byDate;
    return (right.addedAt || "").localeCompare(left.addedAt || "");
  });
  return unique[0] ?? null;
}

/**
 * One block per window, door or similar line. Every page is scanned.
 * A line counts only when the left column has a short label and the
 * description starts with a quantity such as "1,00 stuk(s)". The crop stays
 * between that line and the next position, the carry-over, or the totals.
 * Nothing is invented.
 */
export function extractQuotePositions(pages: QuotePage[]): QuotePositionBlock[] {
  const blocks: QuotePositionBlock[] = [];
  for (const page of pages) {
    const lines = linesOf(page.items);
    const headers = lines
      .map(headerFrom)
      .filter((header): header is Header => header != null)
      .sort((a, b) => b.y - a.y);
    headers.forEach((header, index) => {
      const nextY = headers[index + 1]?.y;
      const stopYs = page.items
        .filter((item) => STOP.test(item.text.trim()) && item.y < header.y - 8)
        .map((item) => item.y);
      if (nextY != null) stopYs.push(nextY);
      stopYs.push(78);
      const boundaryY = Math.max(...stopYs);

      const band = page.items.filter((item) => item.y <= header.y + 1.5 && item.y > boundaryY + 3 && !STOP.test(item.text.trim()));
      const images = page.images.filter((image) => imageInBand(image, header.y, boundaryY, page.width));
      if (band.length === 0) return;

      const textLeft = Math.min(...band.map((item) => item.x), ...images.map((image) => image.x));
      const textRight = Math.max(
        ...band.map((item) => item.x + item.width),
        ...images.map((image) => image.x + image.width),
      );
      const spec = linesOf(band.filter((item) => item.y < header.y - 2));
      const textBottom = spec.length
        ? Math.min(...spec.flat().map((item) => item.y)) - 1
        : header.y - 4;
      const imageBottom = images.length ? Math.min(...images.map((image) => image.y)) : textBottom;
      const lineHeight = Math.max(...header.items.map((item) => item.height || 0), 8);
      const top = header.y + lineHeight + 2;
      let bottom = Math.min(textBottom, imageBottom) - 4;
      const floor = boundaryY + 6;
      if (bottom < floor) bottom = floor;
      if (top - bottom < 18) bottom = top - 18;

      const x = Math.max(6, textLeft - 8);
      const right = Math.min(page.width - 6, textRight + 8);
      if (right - x < 40) return;

      blocks.push({
        id: String(blocks.length),
        pageNumber: page.pageNumber,
        number: header.number,
        title: header.title,
        quantity: header.quantity,
        price: header.price,
        text: spec.map((line) => joinText(line)).filter(Boolean).join("\n").slice(0, 4000),
        crop: { x, y: bottom, width: right - x, height: top - bottom },
      });
    });
  }
  return blocks;
}
