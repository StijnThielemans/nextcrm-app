/** A word from the PDF text layer, in page points. `y` grows upward, as in the PDF. */
export type PlanWord = {
  text: string;
  x: number;
  y: number;
  rotated: boolean;
};

export type PlanSheet = {
  name: string;
  width: number;
  height: number;
  words: PlanWord[];
};

/** A window number, as a fraction of the page from the top-left. */
export type PlanMark = {
  number: string;
  x: number;
  y: number;
};

export type MeasureReading = {
  mm: number;
  method: "gelezen" | "afgeleid";
  plan: string;
};

export type WindowMeasure = {
  number: string;
  onFacade: boolean;
  width: MeasureReading | null;
  height: MeasureReading | null;
  /** The floor-plan width, when the facade width is the view size and the two differ. */
  planWidth: MeasureReading | null;
};

const WIDTH_MIN = 500;
const WIDTH_MAX = 3200;
const HEIGHT_MIN = 1400;
const HEIGHT_MAX = 2700;

type Candidate = { mm: number; score: number };

/**
 * Centimeter when most figures on the sheet are short, which is how these
 * architect plans are drawn. Millimetres only when the sheet is full of
 * four-digit figures.
 */
export function pageUnit(words: PlanWord[]): "mm" | "cm" {
  const values = words.flatMap((word) => (/^\d{2,5}$/.test(word.text) ? [Number(word.text)] : []));
  const long = values.filter((value) => value >= 1000).length;
  return values.length > 0 && long / values.length >= 0.3 ? "mm" : "cm";
}

function millimetres(text: string, unit: "mm" | "cm"): number | null {
  if (!/^\d{2,5}$/.test(text)) return null;
  const value = Number(text);
  return unit === "cm" ? value * 10 : value;
}

function origin(sheet: PlanSheet, mark: PlanMark): { x: number; y: number } {
  return { x: mark.x * sheet.width, y: (1 - mark.y) * sheet.height };
}

function pick(candidates: Candidate[]): Candidate | null {
  const ranked = [...candidates].sort((left, right) => left.score - right.score);
  const best = ranked[0];
  if (!best) return null;
  const rival = ranked.find((item) => Math.abs(item.mm - best.mm) > 40 && item.score - best.score < 18);
  return rival ? null : best;
}

/**
 * A horizontal dimension figure next to the number. A figure above the number
 * wins over one below it. Two different figures that are equally close are
 * left unread. A marker is only a point, so a scale or a pixel ratio is not
 * used: that would be a guess, not a measure.
 */
export function readWidth(sheet: PlanSheet, mark: PlanMark): number | null {
  const unit = pageUnit(sheet.words);
  const at = origin(sheet, mark);
  const candidates: Candidate[] = [];
  for (const word of sheet.words) {
    if (word.rotated) continue;
    const mm = millimetres(word.text, unit);
    if (mm == null || mm < WIDTH_MIN || mm > WIDTH_MAX) continue;
    const dx = word.x - at.x;
    const dy = word.y - at.y;
    if (Math.hypot(dx, dy) > 85 || Math.abs(dx) > 55 || Math.abs(dy) < 4) continue;
    candidates.push({ mm, score: (dy > 0 ? 0 : 70) + Math.abs(dy) + Math.abs(dx) * 0.45 });
  }
  const chosen = pick(candidates);
  return chosen && chosen.score <= 110 ? chosen.mm : null;
}

/** A vertical dimension figure on a facade or section. Floor plans are not a height. */
export function readHeight(sheet: PlanSheet, mark: PlanMark): number | null {
  const unit = pageUnit(sheet.words);
  const at = origin(sheet, mark);
  const candidates: Candidate[] = [];
  for (const word of sheet.words) {
    const mm = millimetres(word.text, unit);
    if (mm == null || mm < HEIGHT_MIN || mm > HEIGHT_MAX) continue;
    const dx = word.x - at.x;
    const dy = word.y - at.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 100 || Math.abs(dx) > 80) continue;
    if (!word.rotated && Math.abs(dx) <= Math.abs(dy)) continue;
    candidates.push({ mm, score: distance });
  }
  return pick(candidates)?.mm ?? null;
}

function reading(plan: string, mm: number | null): MeasureReading | null {
  if (mm == null) return null;
  return { mm, method: "gelezen", plan };
}

/**
 * Width prefers the floor plan and is checked against the facade. When both
 * exist and differ, the facade figure is the view size and the plan figure
 * stays beside it. Height comes only from the facade or section.
 */
export function measuresFromSheets(input: {
  floors: { sheet: PlanSheet; marks: PlanMark[] }[];
  facades: { sheet: PlanSheet; marks: PlanMark[] }[];
}): WindowMeasure[] {
  const numbers: string[] = [];
  for (const floor of input.floors) {
    for (const mark of floor.marks) {
      if (!numbers.includes(mark.number)) numbers.push(mark.number);
    }
  }
  return numbers.map((number) => {
    const floor = input.floors.find((item) => item.marks.some((mark) => mark.number === number));
    const facade = input.facades.find((item) => item.marks.some((mark) => mark.number === number));
    const floorMark = floor?.marks.find((mark) => mark.number === number);
    const facadeMark = facade?.marks.find((mark) => mark.number === number);
    const planWidth = floor && floorMark ? reading(floor.sheet.name, readWidth(floor.sheet, floorMark)) : null;
    const facadeWidth = facade && facadeMark ? reading(facade.sheet.name, readWidth(facade.sheet, facadeMark)) : null;
    const height = facade && facadeMark ? reading(facade.sheet.name, readHeight(facade.sheet, facadeMark)) : null;
    const differ = planWidth != null && facadeWidth != null && Math.abs(planWidth.mm - facadeWidth.mm) > 40;
    return {
      number,
      onFacade: facadeMark != null,
      width: differ ? facadeWidth : (planWidth ?? facadeWidth),
      height,
      planWidth: differ ? planWidth : null,
    };
  });
}
