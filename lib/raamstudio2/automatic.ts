import type { FacadeSide } from "@/lib/raamstudio/facade-order";
import { assignThielemansNumbers, emptyProject, type DrawingKind, type Rs2Project } from "@/lib/raamstudio2/project";
import { floorFromLabels, sideFromLabels, type VisionBox } from "@/lib/raamstudio2/proposals";

export type AnalyzedPage = {
  planId: string;
  planName: string;
  page: number;
  labels: string[];
  openings: VisionBox[];
};

const SIDES = new Set<FacadeSide>(["voorgevel", "rechtergevel", "achtergevel", "linkergevel"]);

/** Snede and gevel win over a ground plan when the name or the page says so. Other plan pages stay ground plans. */
export function classifyKind(planName: string, labels: readonly string[]): DrawingKind {
  const text = `${planName} ${labels.join(" ")}`.toLowerCase();
  if (/snede|coupe|doorsnede|\bsection\b/.test(text)) return "Snede";
  if (/gevel|façade|facade|aanzicht|elevation/.test(text)) return "Gevel";
  return "Grondplan";
}

export function skipPage(planName: string, labels: readonly string[]): boolean {
  return /detail|legende|titelblad|nota/.test(`${planName} ${labels.join(" ")}`.toLowerCase());
}

/** One floor word decides the floor. Several words, or none, do not invent a floor name beyond the fallback. */
export function floorFromText(text: string): string | null {
  return floorFromLabels([text]);
}

export function assembleStudio(pages: readonly AnalyzedPage[], createId: () => string): Rs2Project {
  const project = emptyProject();
  const seeds: { id: string; floor: string; side: FacadeSide | null; along: number; box: VisionBox; page: AnalyzedPage }[] = [];

  for (const page of pages) {
    if (skipPage(page.planName, page.labels)) continue;
    const kind = classifyKind(page.planName, page.labels);
    const text = `${page.planName} ${page.labels.join(" ")}`;
    const side = sideFromLabels([text]);
    const floor = floorFromText(text) ?? "0";
    project.drawings.push({
      id: createId(),
      planId: page.planId,
      planName: page.planName,
      page: page.page,
      kind,
      side: kind === "Grondplan" ? null : side,
      name: [kind, floor, side ?? "", page.planName, `p${page.page}`].filter(Boolean).join(" "),
    });
    if (kind !== "Grondplan") continue;
    for (const box of [...page.openings].sort((a, b) => a.x - b.x || a.y - b.y)) {
      const id = createId();
      const boxSide = box.side && SIDES.has(box.side) ? box.side : side;
      seeds.push({ id, floor, side: boxSide, along: box.x, box, page });
      project.highlights.push({
        id: `mark-${id}`,
        planId: page.planId,
        planName: page.planName,
        page: page.page,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
      });
    }
  }

  const numbers = assignThielemansNumbers(seeds);
  for (const seed of seeds) {
    const number = numbers.get(seed.id) ?? `${seed.floor}.1`;
    project.openings.push({
      id: seed.id,
      number,
      floor: seed.floor,
      side: seed.side,
      planId: seed.page.planId,
      planName: seed.page.planName,
      page: seed.page.page,
      x: seed.box.x + seed.box.w / 2,
      y: seed.box.y + seed.box.h / 2,
      review: "te controleren",
    });
    if (seed.box.widthMm || seed.box.heightMm) {
      project.measures.push({ number, widthMm: seed.box.widthMm ?? "", heightMm: seed.box.heightMm ?? "" });
    }
  }

  for (const page of pages) {
    if (skipPage(page.planName, page.labels)) continue;
    const kind = classifyKind(page.planName, page.labels);
    if (kind === "Grondplan") continue;
    const text = `${page.planName} ${page.labels.join(" ")}`;
    const side = sideFromLabels([text]);
    const floor = floorFromText(text) ?? "0";
    const targets = project.openings
      .filter((opening) => opening.floor === floor && (side == null || opening.side == null || opening.side === side))
      .sort((a, b) => a.x - b.x);
    const boxes = [...page.openings].sort((a, b) => a.x - b.x || a.y - b.y);
    const count = Math.min(targets.length, boxes.length);
    for (let index = 0; index < count; index += 1) {
      const markSide = side ?? targets[index]?.side;
      const box = boxes[index];
      const target = targets[index];
      if (!markSide || !box || !target) continue;
      project.facades.push({
        id: createId(),
        openingNumber: target.number,
        side: markSide,
        planId: page.planId,
        planName: page.planName,
        page: page.page,
        x: box.x + box.w / 2,
        y: box.y + box.h / 2,
      });
    }
    for (const box of boxes) {
      project.highlights.push({
        id: createId(),
        planId: page.planId,
        planName: page.planName,
        page: page.page,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
      });
    }
  }

  return project;
}

/** A second automatic pass replaces earlier proposals and keeps openings a person typed. */
export function applyAutomatic(existing: Rs2Project, fresh: Rs2Project): Rs2Project {
  const manual = existing.openings.filter((opening) => opening.review == null);
  const manualNumbers = new Set(manual.map((opening) => opening.number));
  const openings = fresh.openings.filter((opening) => !manualNumbers.has(opening.number));
  const keptNumbers = new Set([...manualNumbers, ...openings.map((opening) => opening.number)]);
  return {
    ...fresh,
    openings: [...manual, ...openings],
    highlights: [...existing.highlights.filter((mark) => !mark.id.startsWith("mark-")), ...fresh.highlights],
    measures: fresh.measures.filter((measure) => keptNumbers.has(measure.number)),
    raaminfo: existing.raaminfo,
  };
}
