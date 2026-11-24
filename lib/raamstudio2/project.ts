import { FACADE_ORDER, type FacadeSide, normalizeOpeningNumber } from "@/lib/raamstudio/facade-order";

export const RS2_FORMAT = "thielemans-raamstudio-2";
export const RS2_VERSION = "2.0.0";
export const RS2_DESCRIPTION = "Raamstudio-2-project";
export const PROJECT_FILE_NAME = "Raamstudio 2.0.raamstudio";
export const PROJECT_NOTES_NAME = "Projectnotities.pdf";
export const PROJECT_NOTES_DESCRIPTION = "Raamstudio-2-projectnotities";

export const DRAWING_KINDS = ["Grondplan", "Gevel", "Snede"] as const;
export type DrawingKind = (typeof DRAWING_KINDS)[number];

export type Rs2Drawing = {
  id: string;
  planId: string;
  planName: string;
  page: number;
  kind: DrawingKind;
  side: FacadeSide | null;
  name: string;
};

export type Rs2Opening = {
  id: string;
  /** String, never a float: "0.1" and "0.10" stay different. */
  number: string;
  floor: string;
  /** Gevel used by the fixed numbering order. Null until the user sets it. */
  side: FacadeSide | null;
  planId: string;
  planName: string;
  page: number;
  x: number;
  y: number;
};

/** Yellow marker on a ground plan. Fractions of the page, from the top-left. */
export type Rs2Highlight = {
  id: string;
  planId: string;
  planName: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Rs2FacadeMark = {
  id: string;
  openingNumber: string;
  side: FacadeSide;
  planId: string;
  planName: string;
  page: number;
  x: number;
  y: number;
};

export type Rs2Measure = {
  number: string;
  widthMm: string;
  heightMm: string;
};

export type Rs2Info = {
  id: string;
  number: string;
  category: string;
  text: string;
};

export type Rs2Project = {
  format: typeof RS2_FORMAT;
  version: string;
  drawings: Rs2Drawing[];
  openings: Rs2Opening[];
  highlights: Rs2Highlight[];
  facades: Rs2FacadeMark[];
  measures: Rs2Measure[];
  raaminfo: Rs2Info[];
};

export function emptyProject(): Rs2Project {
  return { format: RS2_FORMAT, version: RS2_VERSION, drawings: [], openings: [], highlights: [], facades: [], measures: [], raaminfo: [] };
}

/** One project file per dossier, under Calculatie. Not a .tc-raam. */
export function raamstudio2FileName(_number?: string | null): string {
  return PROJECT_FILE_NAME;
}

export type NumberSeed = {
  id: string;
  floor: string;
  side: FacadeSide | null;
  /** Order along one facade. Lower comes first. */
  along: number;
};

/**
 * Numbering runs across the four facades of one floor and restarts at 1 on the next floor.
 * The suffix is text: the tenth window is "0.10", not "0.1".
 */
export function assignThielemansNumbers(items: readonly NumberSeed[]): Map<string, string> {
  const byFloor = new Map<string, NumberSeed[]>();
  for (const item of items) {
    const floor = item.floor.trim() || "0";
    const list = byFloor.get(floor) ?? [];
    list.push(item);
    byFloor.set(floor, list);
  }
  const assigned = new Map<string, string>();
  const floors = [...byFloor.keys()].sort((a, b) => a.localeCompare(b, "nl", { numeric: true }));
  for (const floor of floors) {
    const list = [...(byFloor.get(floor) ?? [])].sort((a, b) => {
      const left = a.side ? FACADE_ORDER.indexOf(a.side) : FACADE_ORDER.length;
      const right = b.side ? FACADE_ORDER.indexOf(b.side) : FACADE_ORDER.length;
      if (left !== right) return left - right;
      return a.along - b.along;
    });
    list.forEach((item, index) => assigned.set(item.id, `${floor}.${index + 1}`));
  }
  return assigned;
}

/**
 * Next opening on a floor. The suffix is an integer written as text.
 * "0.10" is not read as ten tenths of "0.1".
 */
export function nextOpeningNumber(floor: string, numbers: readonly string[]): string {
  const level = floor.trim() || "0";
  const prefix = `${level}.`;
  let max = 0;
  for (const value of numbers) {
    const number = normalizeOpeningNumber(value);
    if (!number.startsWith(prefix)) continue;
    const rest = number.slice(prefix.length);
    if (!/^\d+$/.test(rest)) continue;
    max = Math.max(max, Number(rest));
  }
  return `${prefix}${max + 1}`;
}

/** First facade side of this opening that is still free, in street order. */
export function nextFacadeSide(used: readonly FacadeSide[]): FacadeSide {
  return FACADE_ORDER.find((side) => !used.includes(side)) ?? FACADE_ORDER[0];
}

export function serializeRs2(project: Rs2Project): string {
  return JSON.stringify(normalizeProject(project));
}

export function parseRs2(text: string): Rs2Project {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Dit .raamstudio-bestand is geen geldige tekst.");
  }
  if (!raw || typeof raw !== "object") throw new Error("Dit is geen Raamstudio 2-project.");
  const record = raw as Record<string, unknown>;
  if (record.format !== RS2_FORMAT) throw new Error("Dit bestand is geen Raamstudio 2-project (.raamstudio).");
  return normalizeProject({
    format: RS2_FORMAT,
    version: typeof record.version === "string" ? record.version : RS2_VERSION,
    drawings: asArray(record.drawings).map(readDrawing).filter((item): item is Rs2Drawing => item != null),
    openings: asArray(record.openings).map(readOpening).filter((item): item is Rs2Opening => item != null),
    highlights: asArray(record.highlights).map(readHighlight).filter((item): item is Rs2Highlight => item != null),
    facades: asArray(record.facades).map(readFacade).filter((item): item is Rs2FacadeMark => item != null),
    measures: asArray(record.measures).map(readMeasure).filter((item): item is Rs2Measure => item != null),
    raaminfo: asArray(record.raaminfo).map(readInfo).filter((item): item is Rs2Info => item != null),
  });
}

function normalizeProject(project: Rs2Project): Rs2Project {
  return {
    format: RS2_FORMAT,
    version: project.version || RS2_VERSION,
    drawings: project.drawings,
    openings: project.openings.map((opening) => ({ ...opening, number: normalizeOpeningNumber(opening.number), side: opening.side })),
    highlights: project.highlights,
    facades: project.facades.map((mark) => ({ ...mark, openingNumber: normalizeOpeningNumber(mark.openingNumber) })),
    measures: project.measures.map((measure) => ({
      number: normalizeOpeningNumber(measure.number),
      widthMm: measure.widthMm.trim(),
      heightMm: measure.heightMm.trim(),
    })),
    raaminfo: project.raaminfo.map((info) => ({ ...info, number: normalizeOpeningNumber(info.number), text: info.text.trim() })),
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readDrawing(value: unknown): Rs2Drawing | null {
  const row = object(value);
  const kind = row.kind;
  if (kind !== "Grondplan" && kind !== "Gevel" && kind !== "Snede") return null;
  const name = text(row.name);
  const planId = text(row.planId);
  const planName = text(row.planName);
  if (!name || !planId || !planName) return null;
  return {
    id: text(row.id) || planId,
    planId,
    planName,
    page: pageOf(row.page),
    kind,
    side: facadeSide(row.side),
    name,
  };
}

function readHighlight(value: unknown): Rs2Highlight | null {
  const row = object(value);
  const planId = text(row.planId);
  const box = fractionBox(row.x, row.y, row.w, row.h);
  if (!planId || !box) return null;
  return {
    id: text(row.id) || planId,
    planId,
    planName: text(row.planName),
    page: pageOf(row.page),
    ...box,
  };
}

function readOpening(value: unknown): Rs2Opening | null {
  const row = object(value);
  const number = normalizeOpeningNumber(text(row.number));
  const planId = text(row.planId);
  if (!number || !planId) return null;
  const point = fraction(row.x, row.y);
  if (!point) return null;
  return {
    id: text(row.id) || number,
    number,
    floor: text(row.floor) || number.split(".")[0] || "0",
    side: facadeSide(row.side),
    planId,
    planName: text(row.planName),
    page: pageOf(row.page),
    x: point.x,
    y: point.y,
  };
}

function readFacade(value: unknown): Rs2FacadeMark | null {
  const row = object(value);
  const side = facadeSide(row.side);
  const openingNumber = normalizeOpeningNumber(text(row.openingNumber));
  const planId = text(row.planId);
  if (!side || !openingNumber || !planId) return null;
  const point = fraction(row.x, row.y);
  if (!point) return null;
  return {
    id: text(row.id) || `${openingNumber}-${side}`,
    openingNumber,
    side,
    planId,
    planName: text(row.planName),
    page: pageOf(row.page),
    x: point.x,
    y: point.y,
  };
}

function readMeasure(value: unknown): Rs2Measure | null {
  const row = object(value);
  const number = normalizeOpeningNumber(text(row.number));
  if (!number) return null;
  return { number, widthMm: text(row.widthMm), heightMm: text(row.heightMm) };
}

function readInfo(value: unknown): Rs2Info | null {
  const row = object(value);
  const number = normalizeOpeningNumber(text(row.number));
  const category = text(row.category);
  const infoText = text(row.text);
  if (!number || !category || !infoText) return null;
  return { id: text(row.id) || `${number}-${category}-${infoText}`, number, category, text: infoText };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pageOf(value: unknown): number {
  const page = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(page) || page < 1 || page > 400) return 1;
  return page;
}

function fractionBox(xValue: unknown, yValue: unknown, wValue: unknown, hValue: unknown): { x: number; y: number; w: number; h: number } | null {
  const point = fraction(xValue, yValue);
  const w = typeof wValue === "number" ? wValue : Number(wValue);
  const h = typeof hValue === "number" ? hValue : Number(hValue);
  if (!point || !(w > 0) || !(h > 0) || point.x + w > 1.002 || point.y + h > 1.002) return null;
  return { x: point.x, y: point.y, w: Math.min(w, 1 - point.x), h: Math.min(h, 1 - point.y) };
}

function fraction(xValue: unknown, yValue: unknown): { x: number; y: number } | null {
  const x = typeof xValue === "number" ? xValue : Number(xValue);
  const y = typeof yValue === "number" ? yValue : Number(yValue);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 1 || y > 1) return null;
  return { x, y };
}

function facadeSide(value: unknown): FacadeSide | null {
  return FACADE_ORDER.find((side) => side === value) ?? null;
}
