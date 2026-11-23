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

export type PlanClip = { x: number; y: number; w: number; h: number };

const MAX_PAGE_PIXELS = 32768;

/**
 * Rasterise only the selected region, at `longestSide` pixels on its long side.
 * The region uses the same top-left fractions as a knipsel on screen.
 * A small crop of a wide sheet is drawn at that size, not cut out of a coarse page.
 */
export async function renderPlanClip(
  bytes: Buffer,
  pageNumber: number,
  rect: PlanClip,
  longestSide?: number,
): Promise<RenderedPlanPage> {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("Het plan is te groot om te openen.");
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 400) throw new Error("Die pagina bestaat niet.");
  if (!(rect.w > 0) || !(rect.h > 0) || rect.x < 0 || rect.y < 0 || rect.x + rect.w > 1.002 || rect.y + rect.h > 1.002) {
    throw new Error("Die selectie valt buiten de pagina.");
  }
  const target = bucketPlanPixels(longestSide ?? 4096);
  const dir = await mkdtemp(path.join(tmpdir(), "raamstudio-clip-"));
  const pdfPath = path.join(dir, "plan.pdf");
  try {
    await writeFile(pdfPath, bytes);
    const box = await displayedPageBox(pdfPath, pageNumber);
    if (!box) throw new Error("Die pagina bestaat niet.");
    const pageLong = Math.max(box.width, box.height);
    const cropLong = Math.max(rect.w * box.width, rect.h * box.height);
    if (cropLong < 0.5) throw new Error("Die selectie valt buiten de pagina.");
    const scaleTo = Math.min(MAX_PAGE_PIXELS, Math.max(target, Math.ceil((target * pageLong) / cropLong)));
    const wide = box.width >= box.height;
    const pagePxW = wide ? scaleTo : Math.max(1, Math.round((scaleTo * box.width) / box.height));
    const pagePxH = wide ? Math.max(1, Math.round((scaleTo * box.height) / box.width)) : scaleTo;
    const x = Math.max(0, Math.min(pagePxW - 1, Math.round(rect.x * pagePxW)));
    const y = Math.max(0, Math.min(pagePxH - 1, Math.round(rect.y * pagePxH)));
    const cropW = Math.max(1, Math.min(pagePxW - x, Math.round(rect.w * pagePxW)));
    const cropH = Math.max(1, Math.min(pagePxH - y, Math.round(rect.h * pagePxH)));
    const png = await renderWithCairo(pdfPath, pageNumber, dir, scaleTo, { x, y, w: cropW, h: cropH });
    return { png, pages: box.pages, ...pngSize(png) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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

async function displayedPageBox(pdfPath: string, pageNumber: number): Promise<{ width: number; height: number; pages: number } | null> {
  try {
    const info = await run("pdfinfo", ["-f", String(pageNumber), "-l", String(pageNumber), pdfPath]);
    const size = new RegExp(`Page\\s+${pageNumber}\\s+size:\\s+([\\d.]+)\\s+x\\s+([\\d.]+)\\s+pts`, "i").exec(info);
    if (!size) return null;
    let width = Number(size[1]);
    let height = Number(size[2]);
    const rot = Number(new RegExp(`Page\\s+${pageNumber}\\s+rot:\\s+(\\d+)`, "i").exec(info)?.[1] ?? "0");
    const turns = ((rot % 360) + 360) % 360;
    if (turns === 90 || turns === 270) {
      const swap = width;
      width = height;
      height = swap;
    }
    const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? "0");
    if (!(width > 0) || !(height > 0)) return null;
    return { width, height, pages: Number.isInteger(pages) && pages > 0 ? pages : pageNumber };
  } catch {
    return null;
  }
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

async function renderWithCairo(
  pdfPath: string,
  pageNumber: number,
  dir: string,
  longestSide: number,
  crop?: { x: number; y: number; w: number; h: number },
): Promise<Buffer> {
  const outBase = path.join(dir, "page");
  const args = [
    "-png",
    "-f",
    String(pageNumber),
    "-l",
    String(pageNumber),
    "-scale-to",
    String(longestSide),
  ];
  if (crop) {
    args.push("-x", String(crop.x), "-y", String(crop.y), "-W", String(crop.w), "-H", String(crop.h));
  }
  args.push("-singlefile", pdfPath, outBase);
  await run("pdftocairo", args, 60_000);
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
