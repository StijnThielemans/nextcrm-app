import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  extractQuotePositions,
  type PdfImageBox,
  type PdfTextRun,
  type QuotePage,
  type QuotePositionBlock,
} from "./quote-positions";

type Matrix = [number, number, number, number, number, number];

type PdfjsModule = {
  getDocument: (params: Record<string, unknown>) => { promise: Promise<PdfDocument> };
  OPS: {
    save: number;
    restore: number;
    transform: number;
    paintImageXObject: number;
    paintJpegXObject: number;
    paintInlineImageXObject: number;
  };
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};

type PdfPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: unknown[] }>;
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>;
};

const RENDER_DPI = 170;
const MAX_PDF_BYTES = 40 * 1024 * 1024;

let pdfjsModule: Promise<PdfjsModule> | null = null;

function fromPdfParse() {
  const fromApp = createRequire(path.join(process.cwd(), "package.json"));
  return createRequire(fromApp.resolve("pdf-parse"));
}

function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsModule) {
    pdfjsModule = (async () => {
      // A computed import() is rewritten by the Next bundler and never reaches Node.
      const load = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<PdfjsModule>;
      const pdfjsPath = fromPdfParse().resolve("pdfjs-dist/legacy/build/pdf.mjs");
      return load(pathToFileURL(pdfjsPath).href);
    })();
  }
  return pdfjsModule;
}

function standardFontUrl(): string | undefined {
  try {
    const root = path.dirname(fromPdfParse().resolve("pdfjs-dist/package.json"));
    return pathToFileURL(path.join(root, "standard_fonts") + path.sep).href;
  } catch {
    return undefined;
  }
}

function multiply(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, e, f] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [
    a * a2 + c * b2,
    b * a2 + d * b2,
    a * c2 + c * d2,
    b * c2 + d * d2,
    a * e2 + c * f2 + e,
    b * e2 + d * f2 + f,
  ];
}

function imageBox(ctm: Matrix): PdfImageBox | null {
  const [a, b, c, d, e, f] = ctm;
  if (Math.abs(b) > 0.5 || Math.abs(c) > 0.5) return null;
  const x = Math.min(e, e + a);
  const y = Math.min(f, f + d);
  const width = Math.abs(a);
  const height = Math.abs(d);
  if (width < 15 || height < 15) return null;
  return { x, y, width, height };
}

async function readPages(bytes: Uint8Array): Promise<QuotePage[]> {
  const pdfjs = await loadPdfjs();
  const standardFontDataUrl = standardFontUrl();
  const loading = pdfjs.getDocument({
    data: bytes,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
    ...(standardFontDataUrl ? { standardFontDataUrl } : {}),
  });
  const doc = await loading.promise;
  try {
    const pages: QuotePage[] = [];
    let lastError: unknown;
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      try {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: PdfTextRun[] = [];
      for (const raw of content.items) {
        if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
        const item = raw as { str: string; width: number; height?: number; transform: number[] };
        if (!item.str) continue;
        items.push({
          text: item.str,
          x: item.transform[4] ?? 0,
          y: item.transform[5] ?? 0,
          width: item.width ?? 0,
          height: item.height || 9,
        });
      }
      const operators = await page.getOperatorList();
      const stack: Matrix[] = [];
      let ctm: Matrix = [1, 0, 0, 1, 0, 0];
      const images: PdfImageBox[] = [];
      for (let index = 0; index < operators.fnArray.length; index += 1) {
        const fn = operators.fnArray[index];
        const args = operators.argsArray[index];
        if (fn === pdfjs.OPS.save) stack.push([...ctm]);
        else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
        else if (fn === pdfjs.OPS.transform && Array.isArray(args)) ctm = multiply(ctm, args as Matrix);
        else if (
          fn === pdfjs.OPS.paintImageXObject
          || fn === pdfjs.OPS.paintJpegXObject
          || fn === pdfjs.OPS.paintInlineImageXObject
        ) {
          const box = imageBox(ctm);
          if (box && box.width < viewport.width * 0.45) images.push(box);
        }
      }
      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        items,
        images,
      });
      } catch (error) {
        lastError = error;
      }
    }
    if (pages.length === 0 && lastError) throw lastError;
    return pages;
  } finally {
    await doc.destroy();
  }
}

function runCairo(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("pdftocairo", args, { stdio: ["ignore", "ignore", "ignore"] });
    child.on("error", () => reject(new Error("pdftocairo missing")));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("pdftocairo failed"));
    });
  });
}

/** One page as a PNG. pdftocairo keeps the drawing and the specification readable. */
async function renderPage(bytes: Buffer, pageNumber: number): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "quote-pos-"));
  const pdfPath = path.join(dir, "quote.pdf");
  const outBase = path.join(dir, "page");
  try {
    await writeFile(pdfPath, bytes);
    await runCairo([
      "-png",
      "-f", String(pageNumber),
      "-l", String(pageNumber),
      "-r", String(RENDER_DPI),
      "-singlefile",
      pdfPath,
      outBase,
    ]);
    return await readFile(`${outBase}.png`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

type CachedQuote = {
  positions: QuotePositionBlock[];
  pages: Map<number, Promise<Buffer>>;
  geometry: QuotePage[];
};

const cache = new Map<string, Promise<CachedQuote>>();

function remember(key: string, value: Promise<CachedQuote>) {
  cache.set(key, value);
  if (cache.size <= 3) return;
  const oldest = cache.keys().next().value;
  if (oldest && oldest !== key) cache.delete(oldest);
}

async function cachedQuote(documentId: string, bytes: Buffer): Promise<CachedQuote> {
  if (bytes.length > MAX_PDF_BYTES) throw new Error("pdf too large");
  const key = `${documentId}:${bytes.length}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = readPages(new Uint8Array(bytes)).then((geometry) => ({
    positions: extractQuotePositions(geometry),
    pages: new Map<number, Promise<Buffer>>(),
    geometry,
  }));
  remember(key, pending);
  try {
    return await pending;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

export async function positionsInQuotePdf(documentId: string, bytes: Buffer): Promise<QuotePositionBlock[]> {
  const parsed = await cachedQuote(documentId, bytes);
  return parsed.positions;
}

export async function renderQuotePosition(documentId: string, bytes: Buffer, positionId: string): Promise<Buffer | null> {
  const parsed = await cachedQuote(documentId, bytes);
  const position = parsed.positions.find((item) => item.id === positionId);
  if (!position) return null;
  const geometry = parsed.geometry.find((page) => page.pageNumber === position.pageNumber);
  if (!geometry) return null;
  let shot = parsed.pages.get(position.pageNumber);
  if (!shot) {
    shot = renderPage(bytes, position.pageNumber);
    parsed.pages.set(position.pageNumber, shot);
  }
  let png: Buffer;
  try {
    png = await shot;
  } catch (error) {
    parsed.pages.delete(position.pageNumber);
    throw error;
  }
  const meta = await sharp(png).metadata();
  const pixelWidth = meta.width ?? 0;
  const pixelHeight = meta.height ?? 0;
  if (pixelWidth < 1 || pixelHeight < 1) return null;
  const scaleX = pixelWidth / geometry.width;
  const scaleY = pixelHeight / geometry.height;
  const left = clamp(Math.round(position.crop.x * scaleX), 0, pixelWidth - 1);
  const top = clamp(Math.round((geometry.height - (position.crop.y + position.crop.height)) * scaleY), 0, pixelHeight - 1);
  const width = clamp(Math.round(position.crop.width * scaleX), 1, pixelWidth - left);
  const height = clamp(Math.round(position.crop.height * scaleY), 1, pixelHeight - top);
  return sharp(png).extract({ left, top, width, height }).png().toBuffer();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
