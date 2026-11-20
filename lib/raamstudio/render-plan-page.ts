import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_BYTES = 40 * 1024 * 1024;
const LONGEST_SIDE = "1800";

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
  getContext: (kind: "2d") => unknown;
  toBuffer: (type: "image/png") => Buffer;
};

export async function renderPlanPage(bytes: Buffer, pageNumber: number): Promise<{ png: Buffer; pages: number }> {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("Het plan is te groot om te openen.");
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 400) throw new Error("Die pagina bestaat niet.");

  const dir = await mkdtemp(path.join(tmpdir(), "raamstudio-plan-"));
  const pdfPath = path.join(dir, "plan.pdf");
  try {
    await writeFile(pdfPath, bytes);
    const pages = await pageCount(pdfPath);
    if (pages > 0 && pageNumber > pages) throw new Error("Die pagina bestaat niet.");
    try {
      const png = await renderWithCairo(pdfPath, pageNumber, dir);
      return { png, pages: pages || pageNumber };
    } catch {
      return renderWithPdfjs(bytes, pageNumber);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timeout`));
    }, 30_000);
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

async function renderWithCairo(pdfPath: string, pageNumber: number, dir: string): Promise<Buffer> {
  const outBase = path.join(dir, "page");
  await run("pdftocairo", [
    "-png",
    "-f",
    String(pageNumber),
    "-l",
    String(pageNumber),
    "-scale-to",
    LONGEST_SIDE,
    "-singlefile",
    pdfPath,
    outBase,
  ]);
  const png = await readFile(`${outBase}.png`);
  if (png.length < 32 || png.readUInt32BE(0) !== 0x89504e47) throw new Error("empty");
  return png;
}

async function renderWithPdfjs(bytes: Buffer, pageNumber: number): Promise<{ png: Buffer; pages: number }> {
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
    const scale = Math.min(2, 1800 / Math.max(base.width, base.height, 1));
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    return { png: canvas.toBuffer("image/png"), pages: doc.numPages };
  } finally {
    await doc.destroy();
  }
}
