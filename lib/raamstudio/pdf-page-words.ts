import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { PlanLine, PlanWord } from "@/lib/raamstudio/opening-measures";

export type PdfPageWords = {
  width: number;
  height: number;
  words: PlanWord[];
  lines: PlanLine[];
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

type PdfPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>;
};

type PdfOps = { save: number; restore: number; transform: number; constructPath: number };

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};

/** Read the text layer of the requested 1-based pages. Missing pages are omitted. */
export async function readPdfPageWords(bytes: Buffer, pages: number[]): Promise<Map<number, PdfPageWords>> {
  const wanted = [...new Set(pages.filter((page) => Number.isInteger(page) && page >= 1 && page <= 400))];
  const found = new Map<number, PdfPageWords>();
  if (!wanted.length || !bytes.length) return found;

  const fromApp = createRequire(path.join(process.cwd(), "package.json"));
  const fromPdfParse = createRequire(fromApp.resolve("pdf-parse"));
  const load = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<{
    getDocument: (params: Record<string, unknown>) => { promise: Promise<PdfDocument> };
    OPS: PdfOps;
  }>;
  const pdfjs = await load(pathToFileURL(fromPdfParse.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
  const fontRoot = path.dirname(fromPdfParse.resolve("pdfjs-dist/package.json"));
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
    standardFontDataUrl: pathToFileURL(path.join(fontRoot, "standard_fonts") + path.sep).href,
  }).promise;
  try {
    for (const pageNumber of wanted) {
      if (pageNumber > doc.numPages) continue;
      const page = await doc.getPage(pageNumber);
      const view = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const words: PlanWord[] = [];
      for (const item of content.items) {
        const text = item.str?.trim();
        const transform = item.transform;
        if (!text || !transform || transform.length < 6) continue;
        words.push({
          text,
          x: transform[4] ?? 0,
          y: transform[5] ?? 0,
          rotated: Math.abs(transform[1] ?? 0) > Math.abs(transform[0] ?? 0),
        });
      }
      const operators = await page.getOperatorList();
      found.set(pageNumber, {
        width: view.width,
        height: view.height,
        words,
        lines: pageLines(operators, pdfjs.OPS),
      });
    }
    return found;
  } finally {
    await doc.destroy();
  }
}

function pageLines(operators: { fnArray: number[]; argsArray: unknown[] }, ops: PdfOps): PlanLine[] {
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const lines: PlanLine[] = [];
  for (let index = 0; index < operators.fnArray.length; index += 1) {
    const fn = operators.fnArray[index];
    const args = operators.argsArray[index];
    if (fn === ops.save) stack.push(matrix.slice());
    else if (fn === ops.restore) matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === ops.transform && Array.isArray(args)) matrix = multiply(matrix, args as number[]);
    else if (fn === ops.constructPath) lines.push(...pathLines(args, matrix));
  }
  return lines;
}

function pathLines(args: unknown, matrix: number[]): PlanLine[] {
  const packed = Array.isArray(args) ? args[1] : null;
  const data = Array.isArray(packed) ? packed[0] as ArrayLike<number> | undefined : undefined;
  if (!data || typeof data.length !== "number") return [];
  const lines: PlanLine[] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let cursor = 0;
  while (cursor < data.length) {
    const op = data[cursor];
    cursor += 1;
    if (op === 0 || op === 1) {
      const nextX = data[cursor];
      const nextY = data[cursor + 1];
      cursor += 2;
      if (op === 1) {
        const from = apply(matrix, x, y);
        const to = apply(matrix, nextX, nextY);
        const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
        if (length >= 6 && length <= 520) lines.push({ x0: from[0], y0: from[1], x1: to[0], y1: to[1] });
      } else {
        startX = nextX;
        startY = nextY;
      }
      x = nextX;
      y = nextY;
    } else if (op === 2) {
      cursor += 6;
      x = data[cursor - 2];
      y = data[cursor - 1];
    } else if (op === 3) {
      cursor += 4;
      x = data[cursor - 2];
      y = data[cursor - 1];
    } else if (op === 4) {
      x = startX;
      y = startY;
    } else break;
  }
  return lines;
}

function multiply(left: number[], right: number[]): number[] {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function apply(matrix: number[], x: number, y: number): [number, number] {
  return [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
}
