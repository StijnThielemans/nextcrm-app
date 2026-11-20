import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { bucketPlanPixels } from "@/lib/raamstudio/plan-pixels";

const MAX_BYTES = 40 * 1024 * 1024;

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};

type PdfPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: unknown; viewport: { width: number; height: number } }) => { promise: Promise<void> };
};

type CanvasLike = {
  width: number;
  height: number;
  getContext: (kind: "2d") => unknown;
  toBuffer: (type: "image/png") => Buffer;
};

export type RenderedPlanPage = {
  png: Buffer;
  pages: number;
  width: number;
  height: number;
};

function pngSize(png: Buffer): { width: number; height: number } {
  if (png.length < 24 || png.readUInt32BE(0) !== 0x89504e47) throw new Error("empty");
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width < 1 || height < 1) throw new Error("empty");
  return { width, height };
}

/** Rasterise one PDF page to a PNG whose longest side matches `longestSide` pixels. */
export async function renderPlanPage(bytes: Buffer, pageNumber: number, longestSide?: number): Promise<RenderedPlanPage> {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("Het plan is te groot om te openen.");
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 400) throw new Error("Die pagina bestaat niet.");
  const target = bucketPlanPixels(longestSide ?? 4096);

  const dir = await mkdtemp(path.join(tmpdir(), "raamstudio-plan-"));
  const pdfPath = path.join(dir, "plan.pdf");
  try {
    await writeFile(pdfPath, bytes);
    const pages = await pageCount(pdfPath);
    if (pages > 0 && pageNumber > pages) throw new Error("Die pagina bestaat niet.");
    try {
      const png = await renderWithCairo(pdfPath, pageNumber, dir, target);
      return { png, pages: pages || pageNumber, ...pngSize(png) };
    } catch {
      return renderWithPdfjs(bytes, pageNumber, target);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function run(command: string, args: string[], timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timeout`));
    }, timeoutMs);
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.slice(0, 400) || `${command} failed`));
    });
  });
}

async function pageCount(pdfPath: string): Promise<number> {
  try {
    const info = await run("pdfinfo", [pdfPath]);
    const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? "0");
    return Number.isInteger(pages) && pages > 0 ? pages : 0;
  } catch {
    return 0;
  }
}

async function renderWithCairo(pdfPath: string, pageNumber: number, dir: string, longestSide: number): Promise<Buffer> {
  const outBase = path.join(dir, "page");
  await run("pdftocairo", [
    "-png",
    "-f",
    String(pageNumber),
    "-l",
    String(pageNumber),
    "-scale-to",
    String(longestSide),
    "-singlefile",
    pdfPath,
    outBase,
  ], 60_000);
  const png = await readFile(`${outBase}.png`);
  pngSize(png);
  return png;
}

async function renderWithPdfjs(bytes: Buffer, pageNumber: number, longestSide: number): Promise<RenderedPlanPage> {
  const fromApp = createRequire(path.join(process.cwd(), "package.json"));
  const fromPdfParse = createRequire(fromApp.resolve("pdf-parse"));
  const load = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<{ getDocument: (params: Record<string, unknown>) => { promise: Promise<PdfDocument> } }>;
  const pdfjs = await load(pathToFileURL(fromPdfParse.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
  const fontRoot = path.dirname(fromPdfParse.resolve("pdfjs-dist/package.json"));
  const { createCanvas } = fromPdfParse("@napi-rs/canvas") as {
    createCanvas: (width: number, height: number) => CanvasLike;
  };
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
    standardFontDataUrl: pathToFileURL(path.join(fontRoot, "standard_fonts") + path.sep).href,
  }).promise;
  try {
    if (pageNumber > doc.numPages) throw new Error("Die pagina bestaat niet.");
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = longestSide / Math.max(base.width, base.height, 1);
    const viewport = page.getViewport({ scale });
    const width = Math.max(1, Math.ceil(viewport.width));
    const height = Math.max(1, Math.ceil(viewport.height));
    const canvas = createCanvas(width, height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const png = canvas.toBuffer("image/png");
    return { png, pages: doc.numPages, width: canvas.width || width, height: canvas.height || height };
  } finally {
    await doc.destroy();
  }
}
