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
) {
  const box = node.getBoundingClientRect();
  const x = box.left - sheet.left;
  const y = box.top - sheet.top;
  ctx.fillStyle = colors.fill;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, box.width, box.height, radius);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.text;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((node.textContent ?? "").trim(), x + box.width / 2, y + box.height / 2);
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
    const img = sheet?.querySelector("img");
    if (!(sheet instanceof HTMLElement) || !(img instanceof HTMLImageElement)) {
      throw new Error("Het plan is nog niet geladen.");
    }
    await waitForImage(img);
    for (let frame = 0; frame < 8 && (sheet.clientWidth < 8 || sheet.clientHeight < 8); frame += 1) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
    if (sheet.clientWidth < 8 || sheet.clientHeight < 8) {
      throw new Error("Het plan is nog niet geladen.");
    }
    const scale = Math.max(2, 1600 / Math.max(sheet.clientWidth, sheet.clientHeight));
    const bar = 22;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sheet.clientWidth * scale));
    canvas.height = Math.max(1, Math.round((sheet.clientHeight + bar) * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Het plan is nog niet geladen.");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sheet.clientWidth, bar);
    ctx.fillStyle = "#104b7c";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(article.getAttribute("data-clip-name") ?? "Gevel", 8, 15);
    ctx.save();
    ctx.translate(0, bar);
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, sheet.clientWidth, sheet.clientHeight);
    const sheetBox = sheet.getBoundingClientRect();
    const imgBox = img.getBoundingClientRect();
    ctx.drawImage(img, imgBox.left - sheetBox.left, imgBox.top - sheetBox.top, imgBox.width, imgBox.height);
    for (const node of sheet.querySelectorAll<HTMLElement>("[data-testid='raamstudio-clip-number']")) {
      paintLabel(ctx, sheetBox, node, NUMBER, 14);
    }
    for (const node of sheet.querySelectorAll<HTMLElement>("[data-testid='raamstudio-facade-width'], [data-testid='raamstudio-facade-height']")) {
      paintLabel(ctx, sheetBox, node, MEASURE, 2);
    }
    for (const node of sheet.querySelectorAll<HTMLElement>("[data-testid='raamstudio-sill']")) {
      paintLabel(ctx, sheetBox, node, SILL, 3);
    }
    ctx.restore();
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("De PDF kon niet worden gemaakt."))), "image/jpeg", 0.85);
    });
    pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
  }
  return pages;
}
