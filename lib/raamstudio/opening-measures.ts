/** A word from the PDF text layer, in page points. `y` grows upward, as in the PDF. */
export type PlanWord = {
  text: string;
  x: number;
  y: number;
  rotated: boolean;
};

/** A straight stroke from the PDF, in page points. `y` grows upward. */
export type PlanLine = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type PlanSheet = {
  name: string;
  width: number;
  height: number;
  words: PlanWord[];
  lines?: PlanLine[];
  /** Clockwise display rotation. Marks are stored in that view; the text is not. */
  rotation?: number;
  /** A facade width is horizontal. A floor-plan width follows the wall, either way. */
  role?: "floor" | "facade";
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
  /** Kept empty. Two disagreeing sources leave the width itself empty. */
  planWidth: MeasureReading | null;
};

const WIDTH_MIN = 500;
const WIDTH_MAX = 3200;
const WIDTH_LINE_MAX = 4200;
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

function unrotated(mark: PlanMark, degrees: number): PlanMark {
  const turn = ((degrees % 360) + 360) % 360;
  if (turn === 90) return { ...mark, x: mark.y, y: 1 - mark.x };
  if (turn === 180) return { ...mark, x: 1 - mark.x, y: 1 - mark.y };
  if (turn === 270) return { ...mark, x: 1 - mark.y, y: mark.x };
  return mark;
}

function origin(sheet: PlanSheet, mark: PlanMark): { x: number; y: number } {
  const point = unrotated(mark, sheet.rotation ?? 0);
  return { x: point.x * sheet.width, y: (1 - point.y) * sheet.height };
}

/** The scale printed on the sheet, such as 1:50 or 1/100. Nothing is assumed. */
export function sheetScale(words: PlanWord[]): number | null {
  for (const word of words) {
    const hit = word.text.match(/1\s*[:/]\s*(\d{2,3})/);
    if (!hit) continue;
    const scale = Number(hit[1]);
    if (scale >= 10 && scale <= 500) return scale;
  }
  return null;
}

function lineInterpretations(text: string): number[] {
  const raw = text.trim();
  const values: number[] = [];
  if (/^\d{1,2}[.,]\d{1,2}$/.test(raw)) {
    const meters = Number(raw.replace(",", "."));
    const mm = Math.round(meters * 1000);
    if (mm >= WIDTH_MIN && mm <= WIDTH_LINE_MAX) values.push(mm);
  }
  if (/^\d{2,4}$/.test(raw)) {
    const value = Number(raw);
    if (value >= WIDTH_MIN && value <= WIDTH_LINE_MAX) values.push(value);
    if (value * 10 >= WIDTH_MIN && value * 10 <= WIDTH_LINE_MAX) values.push(value * 10);
  }
  return [...new Set(values)];
}

/**
 * The dimension line that runs across the opening. The printed scale only
 * decides whether that figure is centimetres, millimetres or metres. A second
 * figure just as close, with a different length, is left unread.
 */
function readWidthOnLine(sheet: PlanSheet, mark: PlanMark): number | null {
  const scale = sheetScale(sheet.words);
  const lines = sheet.lines ?? [];
  if (!scale || !lines.length) return null;
  const at = origin(sheet, mark);
  const hits: { mm: number; dist: number }[] = [];
  for (const line of lines) {
    const dx = Math.abs(line.x0 - line.x1);
    const dy = Math.abs(line.y0 - line.y1);
    const horizontal = dy <= 1.5 && dx >= 8;
    const vertical = sheet.role !== "facade" && dx <= 1.5 && dy >= 8;
    if (!horizontal && !vertical) continue;
    const span = horizontal ? dx : dy;
    const along0 = horizontal ? Math.min(line.x0, line.x1) : Math.min(line.y0, line.y1);
    const along1 = along0 + span;
    const cross = horizontal ? (line.y0 + line.y1) / 2 : (line.x0 + line.x1) / 2;
    const markAlong = horizontal ? at.x : at.y;
    const markCross = horizontal ? at.y : at.x;
    if (markAlong < along0 - 2 || markAlong > along1 + 2 || Math.abs(cross - markCross) > 48) continue;
    for (const word of sheet.words) {
      if (horizontal ? word.rotated : !word.rotated) continue;
      const wordAlong = horizontal ? word.x : word.y;
      const wordCross = horizontal ? word.y : word.x;
      if (Math.abs(wordCross - cross) > 10 || wordAlong < along0 - 5 || wordAlong > along1 + 5) continue;
      if (Math.abs(wordAlong - markAlong) > 32) continue;
      for (const mm of lineInterpretations(word.text)) {
        const want = mm / scale / 25.4 * 72;
        if (Math.abs(span - want) <= Math.max(6, want * 0.16)) hits.push({ mm, dist: Math.abs(cross - markCross) });
      }
    }
  }
  if (!hits.length) return null;
  hits.sort((left, right) => left.dist - right.dist);
  const best = hits[0];
  const rival = hits.find((hit) => Math.abs(hit.mm - best.mm) > 40 && hit.dist <= best.dist + 4);
  return rival ? null : best.mm;
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
  if ((sheet.lines?.length ?? 0) > 0 && sheetScale(sheet.words)) return readWidthOnLine(sheet, mark);
  return readWidthNearby(sheet, mark);
}

function readWidthNearby(sheet: PlanSheet, mark: PlanMark): number | null {
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
 * Width comes from the floor plan or the facade. When both exist and differ,
 * the field stays empty. Height comes only from the facade or section.
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
      width: differ ? null : (planWidth ?? facadeWidth),
      height,
      planWidth: null,
    };
  });
}
