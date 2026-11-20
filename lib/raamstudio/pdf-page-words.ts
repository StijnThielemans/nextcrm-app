import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { PlanWord } from "@/lib/raamstudio/opening-measures";

export type PdfPageWords = {
  width: number;
  height: number;
  words: PlanWord[];
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

type PdfPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
};

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
  ) => Promise<{ getDocument: (params: Record<string, unknown>) => { promise: Promise<PdfDocument> } }>;
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
      found.set(pageNumber, { width: view.width, height: view.height, words });
    }
    return found;
  } finally {
    await doc.destroy();
  }
}
