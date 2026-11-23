import type { SheetJpeg } from "@/lib/raamstudio/sheet-pdf";

const SILL = { fill: "#e2f0ff", line: "#1769aa", text: "#104b7c" };
const NUMBER = { fill: "#ffffff", line: "#cd2341", text: "#cd2341" };
const MEASURE = { fill: "#ffffff", line: "#ffffff", text: "#111111" };

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function paintLabel(
  ctx: CanvasRenderingContext2D,
  sheet: DOMRect,
  node: HTMLElement,
  colors: { fill: string; line: string; text: string },
  radius: number,
  scale: number,
) {
  const box = node.getBoundingClientRect();
  const x = (box.left - sheet.left) * scale;
  const y = (box.top - sheet.top) * scale;
  const width = box.width * scale;
  const height = box.height * scale;
  ctx.fillStyle = colors.fill;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = Math.max(1, scale);
  roundRect(ctx, x, y, width, height, radius * scale);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.text;
  ctx.font = `${Math.max(11, Math.round(11 * scale))}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((node.textContent ?? "").trim(), x + width / 2, y + height / 2);
}

async function waitForImage(img: HTMLImageElement) {
  if (img.complete && img.naturalWidth > 0) return;
  await new Promise<void>((resolve, reject) => {
    const done = () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", fail);
      reject(new Error("Het plan is nog niet geladen."));
    };
    img.addEventListener("load", done);
    img.addEventListener("error", fail);
  });
}

/**
 * Draw each clip in this board as it stands.
 * An empty board yields no pages, so a missing set is not invented.
 * Labels are only the numbers, measures and onderaansluitingen already on the clip.
 */
export async function captureFacadeBoard(root: ParentNode): Promise<SheetJpeg[]> {
  const articles = [...root.querySelectorAll("[data-testid='raamstudio-clip-view']")];
  const pages: SheetJpeg[] = [];
  for (const article of articles) {
    const sheet = article.querySelector("[data-testid='raamstudio-clip-sheet']");
    const bitmap = sheet?.querySelector("canvas");
    const img = sheet?.querySelector("img");
    if (!(sheet instanceof HTMLElement) || (!(bitmap instanceof HTMLCanvasElement) && !(img instanceof HTMLImageElement))) {
      throw new Error("Het plan is nog niet geladen.");
    }
    if (img instanceof HTMLImageElement) await waitForImage(img);
    for (let frame = 0; frame < 8 && (sheet.clientWidth < 8 || sheet.clientHeight < 8); frame += 1) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
    const sourceW = bitmap instanceof HTMLCanvasElement && bitmap.width > 8 ? bitmap.width : img instanceof HTMLImageElement ? img.naturalWidth : 0;
    const sourceH = bitmap instanceof HTMLCanvasElement && bitmap.height > 8 ? bitmap.height : img instanceof HTMLImageElement ? img.naturalHeight : 0;
    if (sheet.clientWidth < 8 || sheet.clientHeight < 8 || sourceW < 8 || sourceH < 8) {
      throw new Error("Het plan is nog niet geladen.");
    }
    const scale = sourceW / sheet.clientWidth;
    const bar = Math.max(22, Math.round(22 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = sourceW;
    canvas.height = sourceH + bar;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Het plan is nog niet geladen.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, bar);
    ctx.fillStyle = "#104b7c";
    ctx.font = `${Math.max(12, Math.round(12 * scale))}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(article.getAttribute("data-clip-name") ?? "Gevel", 8 * scale, bar / 2);
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, bar, sourceW, sourceH);
    if (bitmap instanceof HTMLCanvasElement && bitmap.width > 8) ctx.drawImage(bitmap, 0, bar);
    else if (img instanceof HTMLImageElement) ctx.drawImage(img, 0, bar, sourceW, sourceH);
    const sheetBox = sheet.getBoundingClientRect();
    ctx.save();
    ctx.translate(0, bar);
    for (const node of sheet.querySelectorAll<HTMLElement>("[data-testid='raamstudio-clip-number']")) {
      paintLabel(ctx, sheetBox, node, NUMBER, 14, scale);
    }
    for (const node of sheet.querySelectorAll<HTMLElement>("[data-testid='raamstudio-facade-width'], [data-testid='raamstudio-facade-height']")) {
      paintLabel(ctx, sheetBox, node, MEASURE, 2, scale);
    }
    for (const node of sheet.querySelectorAll<HTMLElement>("[data-testid='raamstudio-sill']")) {
      paintLabel(ctx, sheetBox, node, {
        fill: node.dataset.pale || SILL.fill,
        line: node.dataset.line || SILL.line,
        text: node.dataset.ink || SILL.text,
      }, 3, scale);
    }
    ctx.restore();
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("De PDF kon niet worden gemaakt."))), "image/jpeg", 0.92);
    });
    pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
  }
  return pages;
}
