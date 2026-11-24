import type { FacadeSide } from "@/lib/raamstudio/facade-order";
import { nextOpeningNumber, type Rs2Highlight, type Rs2Opening } from "@/lib/raamstudio2/project";

export type VisionBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  source: string;
  nearby: string[];
  status: "te controleren";
};

/** One facade name on the page can be used. Several names stay undecided. */
export function sideFromLabels(labels: readonly string[]): FacadeSide | null {
  const found = new Set<FacadeSide>();
  for (const label of labels) {
    const text = label.toLowerCase();
    if (/voorgevel|façade avant|facade avant/.test(text)) found.add("voorgevel");
    else if (/rechtergevel|façade droite|facade droite/.test(text)) found.add("rechtergevel");
    else if (/achtergevel|façade arrière|facade arriere|façade arriere/.test(text)) found.add("achtergevel");
    else if (/linkergevel|façade gauche|facade gauche/.test(text)) found.add("linkergevel");
  }
  return found.size === 1 ? [...found][0] : null;
}

/** A floor word is used only when the page names exactly one floor. */
export function floorFromLabels(labels: readonly string[]): string | null {
  const found = new Set<string>();
  for (const label of labels) {
    const text = label.toLowerCase();
    if (/kelder|sous-sol/.test(text)) found.add("-1");
    else if (/gelijkvloers|rez-de-chaussée|rez-de-chaussee|\brdc\b/.test(text)) found.add("0");
    else if (/tweede|2e verdieping|étage 2|etage 2/.test(text)) found.add("2");
    else if (/eerste|1e verdieping|étage 1|etage 1|verdieping 1/.test(text)) found.add("1");
  }
  return found.size === 1 ? [...found][0] : null;
}

export function buildProposals(input: {
  boxes: readonly VisionBox[];
  labels: readonly string[];
  floorFallback: string;
  existing: readonly { x: number; y: number; number: string }[];
  planId: string;
  planName: string;
  page: number;
  createId: () => string;
}): { openings: Rs2Opening[]; highlights: Rs2Highlight[] } {
  const side = sideFromLabels(input.labels);
  const floor = floorFromLabels(input.labels) ?? (input.floorFallback.trim() || "0");
  const numbers = input.existing.map((item) => item.number);
  const openings: Rs2Opening[] = [];
  const highlights: Rs2Highlight[] = [];
  const boxes = [...input.boxes].sort((a, b) => a.x - b.x || a.y - b.y);
  for (const box of boxes) {
    const centerX = box.x + box.w / 2;
    const centerY = box.y + box.h / 2;
    const already = [...input.existing, ...openings].some((item) => Math.abs(item.x - centerX) < 0.02 && Math.abs(item.y - centerY) < 0.02);
    if (already) continue;
    const id = input.createId();
    const number = nextOpeningNumber(floor, [...numbers, ...openings.map((item) => item.number)]);
    openings.push({
      id,
      number,
      floor,
      side,
      planId: input.planId,
      planName: input.planName,
      page: input.page,
      x: centerX,
      y: centerY,
      review: "te controleren",
    });
    highlights.push({ id: `mark-${id}`, planId: input.planId, planName: input.planName, page: input.page, x: box.x, y: box.y, w: box.w, h: box.h });
  }
  return { openings, highlights };
}
