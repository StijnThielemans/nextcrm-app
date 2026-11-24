import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { FACADE_ORDER } from "@/lib/raamstudio/facade-order";
import type { Rs2Drawing, Rs2Project } from "./project";

/** Grondplannen, then the four facades, then sections. Generated notes are never a source. */
export function projectNotesOrder(drawings: readonly Rs2Drawing[]): Rs2Drawing[] {
  const grounds = drawings.filter((drawing) => drawing.kind === "Grondplan");
  const facades = drawings
    .filter((drawing) => drawing.kind === "Gevel")
    .sort((a, b) => FACADE_ORDER.indexOf(a.side ?? "voorgevel") - FACADE_ORDER.indexOf(b.side ?? "voorgevel"));
  const cuts = drawings.filter((drawing) => drawing.kind === "Snede");
  return [...grounds, ...facades, ...cuts];
}

/**
 * Copy the original PDF pages and draw vector text and highlights on top.
 * The source page content is not rasterised.
 */
export async function buildProjectnotities(project: Rs2Project, sources: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  const ordered = projectNotesOrder(project.drawings);
  if (!ordered.length) throw new Error("Er zijn nog geen tekeningen om in Projectnotities te zetten.");
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  for (const drawing of ordered) {
    const bytes = sources.get(drawing.planId);
    if (!bytes) throw new Error(`Het plan ${drawing.planName} is niet meer beschikbaar.`);
    const source = await PDFDocument.load(bytes);
    const index = drawing.page - 1;
    if (index < 0 || index >= source.getPageCount()) throw new Error(`Pagina ${drawing.page} staat niet in ${drawing.planName}.`);
    const [page] = await out.copyPages(source, [index]);
    out.addPage(page);
    const { width, height } = page.getSize();
    for (const mark of project.highlights.filter((item) => item.planId === drawing.planId && item.page === drawing.page)) {
      page.drawRectangle({
        x: mark.x * width,
        y: height - (mark.y + mark.h) * height,
        width: mark.w * width,
        height: mark.h * height,
        color: rgb(1, 0.92, 0.23),
        opacity: 0.35,
      });
    }
    const labels = labelsOn(project, drawing);
    labels.forEach((label, index) => {
      page.drawText(label.text, {
        x: Math.min(width - 8, Math.max(4, label.x * width)),
        y: Math.min(height - 8, Math.max(8, height - label.y * height - index * 11)),
        size: 9,
        font,
        color: rgb(0.75, 0.05, 0.08),
      });
    });
  }
  return out.save();
}

function labelsOn(project: Rs2Project, drawing: Rs2Drawing): { text: string; x: number; y: number }[] {
  const labels: { text: string; x: number; y: number }[] = [];
  if (drawing.kind === "Grondplan") {
    for (const opening of project.openings.filter((item) => item.planId === drawing.planId && item.page === drawing.page)) {
      labels.push({ text: opening.number, x: opening.x, y: opening.y });
    }
    return labels;
  }
  for (const mark of project.facades.filter((item) => item.planId === drawing.planId && item.page === drawing.page)) {
    const measure = project.measures.find((item) => item.number === mark.openingNumber);
    const notes = project.raaminfo.filter((item) => item.number === mark.openingNumber).map((item) => item.text);
    const size = measure && (measure.widthMm || measure.heightMm) ? `${measure.widthMm || "—"} × ${measure.heightMm || "—"} mm` : "";
    const text = [mark.openingNumber, size, ...notes].filter(Boolean).join("\n");
    text.split("\n").forEach((line, index) => labels.push({ text: line, x: mark.x, y: mark.y + index * 0.02 }));
  }
  return labels;
}
