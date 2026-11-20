/**
 * The RaamStudio calculatie workspace that follows Projectgegevens.
 * Field names match MainWindow._project_payload. Prices are not part of this file.
 */

import { RAAMSTUDIO_FORMAT } from "./read-project";

export const RAAMSTUDIO_APP_VERSION = "0.18.1";
export const RAAMSTUDIO_DOCUMENT_DESCRIPTION = "RaamStudio-project";

export const DRAWING_KINDS = [
  "Verdieping / grondplan",
  "Gevel",
  "Snede",
  "Dakplan",
  "Detail",
  "Overig",
] as const;

/** WindowInfoWorkspace.OPTIONS_BY_CATEGORY from the desktop program. */
export const RAAMINFO_OPTIONS: Record<string, readonly string[]> = {
  Onderaansluiting: [
    "Rubber", "Onderdorpel", "Renodorpel",
    "Alu dorpel 100", "Alu dorpel 110", "Alu dorpel 120", "Alu dorpel 130", "Alu dorpel 140",
    "Alu dorpel 150", "Alu dorpel 160", "Alu dorpel 170", "Alu dorpel 180", "Alu dorpel 190",
    "Alu dorpel 200", "Alu dorpel 210", "Alu dorpel 220", "Alu dorpel 230", "Alu dorpel 240",
    "Alu dorpel 250", "Alu dorpel 260", "Alu dorpel 270", "Alu dorpel 280", "Alu dorpel 290",
    "Alu dorpel 300", "Alu dorpel 310", "Alu dorpel 320", "Alu dorpel 330", "Alu dorpel 340",
    "Alu dorpel 350",
  ],
  Deur: [
    "Veiligheidscilinder", "Aluminium trekker PP", "Auto. tochtflatsluiter", "Onzichtbare deurdranger",
    "Duitse dorper", "Elektrisch slotpad", "Enkel Kruk Binnen", "VOD paneel binnenkant",
    "Kruk binnen+buiten", "VOD paneel buitenkant", "Motorslot", "Paniekkruk EN179",
    "Reynaers trekker", "Vaste schelpkruk buiten", "Werfc ilinder",
  ],
  Extra: ["Ophoogprofiel", "Screen", "Rolluik", "Verhoogd bovenprofiel voorzien", "Rooster"],
  Schuifraam: ["Kruk+komgreep+Knopcilinder", "Kruk+komgreep ZONDER cilinder"],
  Hoek: ["Glas op glas hoek", "Vaste hoek voorzien"],
  "Eigen tekst": [],
};

export const WORKSPACE_STEPS = [
  { id: "tekeningen", label: "Tekeningen", hint: "Sleep een kader rond een gevel, snede of grondplan en geef het een naam." },
  { id: "grondplan", label: "Grondplan", hint: "Alleen de grondplannen. Links staan de nummers. Klik op een grondplan om het volgende nummer te zetten." },
  { id: "gevels", label: "Gevels", hint: "Alleen gevels en snedes. Kies links een nummer van het grondplan en klik op de tekening." },
  { id: "maten", label: "Maten", hint: "Vul breedte en hoogte in millimeter in." },
  { id: "raaminfo", label: "Raaminfo", hint: "Kies raaminfo bij het raamnummer." },
] as const;

export type WorkspaceStepId = (typeof WORKSPACE_STEPS)[number]["id"];

/** A rectangle on the rendered page, from the top-left, as a fraction of the page. */
export type NormRect = { x: number; y: number; w: number; h: number };

export type WorkspaceDrawing = { planName: string; kind: string; name: string; page?: number; rect?: NormRect };
export type WorkspaceOpening = {
  planName: string;
  floor: string;
  number: string;
  page?: number;
  x?: number;
  y?: number;
  rect?: NormRect;
};
export type WorkspaceFacade = { planName: string; number: string; page?: number; x?: number; y?: number };
export type WorkspaceSize = { number: string; orientation: "width" | "height"; valueMm: string };
export type WorkspaceRaaminfo = { number: string; category: string; text: string };

/** Clockwise page rotation, the same steps as PyMuPDF page.rotation. 0 is omitted. */
export type QuarterTurn = 90 | 180 | 270;

/** One open PDF page. Page 0 is stored, because a later page can turn on its own. */
export type PageRotation = { planName: string; page: number; degrees: QuarterTurn };

export type WorkspaceDraft = {
  drawings: WorkspaceDrawing[];
  openings: WorkspaceOpening[];
  facades: WorkspaceFacade[];
  sizes: WorkspaceSize[];
  raaminfo: WorkspaceRaaminfo[];
  pageRotations: PageRotation[];
};

export type DossierPrefill = {
  number: string | null;
  name: string | null;
  customer: string | null;
  siteAddress: string;
  contact: string;
  seller: string | null;
  projectGroup: string | null;
};

export const EMPTY_DRAFT: WorkspaceDraft = {
  drawings: [],
  openings: [],
  facades: [],
  sizes: [],
  raaminfo: [],
  pageRotations: [],
};

const LIMIT = 400;

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function baseName(value: string): string {
  const parts = value.split(/[/\\]/);
  return parts[parts.length - 1] || value;
}

function roundUnit(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** A fraction of the rendered page. Values outside 0–1 are not a web mark. */
function unit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return roundUnit(value);
}

/** Page 0 stays omitted so an older file without a page still round-trips. */
function pageNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > 500) return undefined;
  return value;
}

function normRect(value: unknown): NormRect | null {
  let rawX: unknown;
  let rawY: unknown;
  let rawW: unknown;
  let rawH: unknown;
  if (isRecord(value) && ("w" in value || "h" in value)) {
    rawX = value.x;
    rawY = value.y;
    rawW = value.w;
    rawH = value.h;
  } else if (Array.isArray(value) && value.length >= 4) {
    rawX = value[0];
    rawY = value[1];
    rawW = Number(value[2]) - Number(value[0]);
    rawH = Number(value[3]) - Number(value[1]);
  } else {
    return null;
  }
  const x = unit(rawX);
  const y = unit(rawY);
  const w = unit(rawW);
  const h = unit(rawH);
  if (x == null || y == null || w == null || h == null || w < 0.008 || h < 0.008) return null;
  const width = Math.min(w, roundUnit(1 - x));
  const height = Math.min(h, roundUnit(1 - y));
  if (width < 0.008 || height < 0.008) return null;
  return { x, y, w: width, h: height };
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, roundUnit(value)));
}

/** Page index including 0. Drawing marks still omit page 0. */
function pageIndex(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 500) return null;
  return value;
}

function quarterTurn(value: unknown): QuarterTurn | null {
  const turn = typeof value === "number" ? ((value % 360) + 360) % 360 : NaN;
  if (turn === 90 || turn === 180 || turn === 270) return turn;
  return null;
}

/**
 * A displayed point after a clockwise quarter turn.
 * 90°: (x, y) -> (1 - y, x). 270° is one step left, the same as the desktop ↶ button.
 */
export function rotateNormalizedPoint(x: number, y: number, degrees: number): { x: number; y: number } {
  const turn = ((degrees % 360) + 360) % 360;
  if (turn === 90) return { x: clampUnit(1 - y), y: clampUnit(x) };
  if (turn === 180) return { x: clampUnit(1 - x), y: clampUnit(1 - y) };
  if (turn === 270) return { x: clampUnit(y), y: clampUnit(1 - x) };
  return { x: clampUnit(x), y: clampUnit(y) };
}

/** The rectangle around the same sheet region after the page turns clockwise. */
export function rotateNormalizedRect(rect: NormRect, degrees: number): NormRect {
  const corners = [
    rotateNormalizedPoint(rect.x, rect.y, degrees),
    rotateNormalizedPoint(rect.x + rect.w, rect.y, degrees),
    rotateNormalizedPoint(rect.x + rect.w, rect.y + rect.h, degrees),
    rotateNormalizedPoint(rect.x, rect.y + rect.h, degrees),
  ];
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    w: clampUnit(Math.max(...xs) - x),
    h: clampUnit(Math.max(...ys) - y),
  };
}

export function pageRotationOf(draft: WorkspaceDraft, planName: string, page: number): number {
  return draft.pageRotations.find((item) => item.planName === planName && item.page === page)?.degrees ?? 0;
}

/**
 * Turn one PDF page and move every mark on that page with it.
 * Other pages and other PDFs stay where they are. Prices are not touched.
 */
export function rotatePlanPage(draft: WorkspaceDraft, planName: string, page: number, delta: 90 | -90): WorkspaceDraft {
  const clockwise = delta === 90 ? 90 : 270;
  const onPage = (name: string, itemPage?: number) => name === planName && (itemPage ?? 0) === page;
  const drawings = draft.drawings.map((drawing) => {
    if (!onPage(drawing.planName, drawing.page) || !drawing.rect) return drawing;
    return { ...drawing, rect: rotateNormalizedRect(drawing.rect, clockwise) };
  });
  const openings = draft.openings.map((opening) => {
    if (!onPage(opening.planName, opening.page)) return opening;
    const point = opening.x != null && opening.y != null
      ? rotateNormalizedPoint(opening.x, opening.y, clockwise)
      : null;
    const rect = opening.rect ? rotateNormalizedRect(opening.rect, clockwise) : null;
    return {
      ...opening,
      ...(point ?? {}),
      ...(rect ? { rect } : {}),
    };
  });
  const facades = draft.facades.map((facade) => {
    if (!onPage(facade.planName, facade.page) || facade.x == null || facade.y == null) return facade;
    return { ...facade, ...rotateNormalizedPoint(facade.x, facade.y, clockwise) };
  });
  const current = pageRotationOf(draft, planName, page);
  const next = quarterTurn((current + clockwise) % 360);
  const pageRotations = draft.pageRotations.filter((item) => !(item.planName === planName && item.page === page));
  if (next) pageRotations.push({ planName, page, degrees: next });
  return { ...draft, drawings, openings, facades, pageRotations };
}

export function raamstudioDocumentName(number: string | null): string {
  const safe = clean(number ?? "", 80).replace(/[<>:"/\\|?*]/g, "_") || "dossier";
  return `RaamStudio ${safe}.tc-raam`;
}

/** MainWindow.next_number: the next raamnummer on a floor. */
export function nextWindowNumber(previous: string | null, floor: string): string {
  const level = clean(floor, 12) || "0";
  if (!previous) return `${level}.1`;
  const match = /^(.*?)(\d+)([a-zA-Z]?)$/.exec(previous.trim());
  if (!match) return `${level}.1`;
  const [, prefix, digits, suffix] = match;
  if (suffix) {
    return suffix.toLowerCase() < "z"
      ? `${prefix}${digits}${String.fromCharCode(suffix.toLowerCase().charCodeAt(0) + 1)}`
      : `${prefix}${Number(digits) + 1}`;
  }
  return `${prefix}${Number(digits) + 1}`;
}

/** The plans are already on the dossier, so the workspace opens on Tekeningen. */
export function openingStep(_plans: { name: string; kind: string }[]): WorkspaceStepId {
  return "tekeningen";
}

/** Desktop workflow numbers. 1 and 2 are project data and PDFs, which this screen skips. */
const DESKTOP_STEP: Record<WorkspaceStepId, number> = {
  tekeningen: 3,
  grondplan: 4,
  gevels: 5,
  maten: 6,
  raaminfo: 7,
};

export function desktopStepIndex(step: WorkspaceStepId): number {
  return DESKTOP_STEP[step];
}

/** A saved desktop step, or null when the file has none this screen can open. */
export function stepFromActiveStep(value: unknown): WorkspaceStepId | null {
  const index = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isInteger(index)) return null;
  const found = (Object.entries(DESKTOP_STEP) as [WorkspaceStepId, number][]).find(([, desktop]) => desktop === index);
  return found?.[0] ?? null;
}

export function planForStep<T extends { name: string; kind: string }>(
  plans: T[],
  step: WorkspaceStepId,
): T | null {
  const pdfs = plans.filter((plan) => plan.kind === "plan");
  if (!pdfs.length) return null;
  if (step === "gevels") return pdfs.find((plan) => /gevel|snede|_G_N_|_S_N_/i.test(plan.name)) ?? pdfs[0];
  if (step === "grondplan") return pdfs.find((plan) => /grondplan|_P_N_/i.test(plan.name)) ?? pdfs[0];
  return pdfs[0];
}

/** Drawing type from the file name, the same kinds as the desktop type list. */
export function suggestedDrawingKind(planName: string): (typeof DRAWING_KINDS)[number] {
  const name = planName.toLowerCase();
  if (/snede|doorsnede|section|_s_n_/.test(name)) return "Snede";
  if (/dakplan|dakvlak/.test(name)) return "Dakplan";
  if (/\bdetail\b|_d_n_/.test(name)) return "Detail";
  if (/grondplan|gelijkvloers|verdiep|kelder|zolder|_p_n_/.test(name)) return "Verdieping / grondplan";
  return "Gevel";
}

/** A name for a one-drawing sheet, from the file name. Empty when nothing is recognisable. */
export function suggestedDrawingName(planName: string): string {
  const base = baseName(planName).replace(/\.pdf$/i, "");
  if (/_vg_|voorgevel/.test(base.toLowerCase())) return "Voorgevel";
  if (/_ag_|achtergevel/.test(base.toLowerCase())) return "Achtergevel";
  if (/_lg_/.test(base.toLowerCase())) return "Zijgevel links";
  if (/_rg_/.test(base.toLowerCase())) return "Zijgevel rechts";
  const snede = /_S_N_([A-Za-z0-9]+)_/i.exec(base);
  if (snede) return `Snede ${snede[1].toUpperCase()}`;
  const level = /_P_N_([+-]?\d+)_/i.exec(base);
  if (level) {
    const code = level[1].replace("+", "");
    return code === "0" ? "Gelijkvloers" : `Niveau ${level[1]}`;
  }
  if (/grondplan/i.test(base)) return "Grondplan";
  if (/gevel/i.test(base)) return "Gevel";
  return "";
}

function canonicalPlan(name: string, planNames: readonly string[]): string | null {
  const cleaned = clean(name, 180);
  if (!cleaned) return null;
  return planNames.find((plan) => plan === cleaned)
    ?? planNames.find((plan) => plan.toLowerCase() === cleaned.toLowerCase())
    ?? null;
}

function millimetres(value: unknown): string | null {
  const text = clean(value, 12).replace(/\s/g, "");
  if (!/^\d{1,5}([.,]\d{1,2})?$/.test(text)) return null;
  return text;
}

export function normalizeDraft(draft: WorkspaceDraft, planNames: readonly string[]): WorkspaceDraft {
  const drawings: WorkspaceDrawing[] = [];
  for (const drawing of draft.drawings.slice(0, LIMIT)) {
    const planName = canonicalPlan(drawing.planName, planNames);
    const name = clean(drawing.name, 120);
    if (!planName || !name || !DRAWING_KINDS.includes(drawing.kind as (typeof DRAWING_KINDS)[number])) continue;
    const rect = normRect(drawing.rect);
    const page = pageNumber(drawing.page);
    drawings.push({ planName, kind: drawing.kind, name, ...(page ? { page } : {}), ...(rect ? { rect } : {}) });
  }
  const openings: WorkspaceOpening[] = [];
  for (const opening of draft.openings.slice(0, LIMIT)) {
    const planName = canonicalPlan(opening.planName, planNames);
    const number = clean(opening.number, 40);
    if (!planName || !number) continue;
    const x = unit(opening.x);
    const y = unit(opening.y);
    const rect = normRect(opening.rect);
    const page = pageNumber(opening.page);
    openings.push({
      planName,
      floor: clean(opening.floor, 12) || "0",
      number,
      ...(page ? { page } : {}),
      ...(x != null && y != null ? { x, y } : {}),
      ...(rect ? { rect } : {}),
    });
  }
  const facades: WorkspaceFacade[] = [];
  for (const facade of draft.facades.slice(0, LIMIT)) {
    const planName = canonicalPlan(facade.planName, planNames);
    const number = clean(facade.number, 40);
    if (!planName || !number) continue;
    const x = unit(facade.x);
    const y = unit(facade.y);
    const page = pageNumber(facade.page);
    facades.push({
      planName,
      number,
      ...(page ? { page } : {}),
      ...(x != null && y != null ? { x, y } : {}),
    });
  }
  const sizes: WorkspaceSize[] = [];
  for (const size of draft.sizes.slice(0, LIMIT)) {
    const number = clean(size.number, 40);
    const valueMm = millimetres(size.valueMm);
    if (!number || !valueMm || (size.orientation !== "width" && size.orientation !== "height")) continue;
    sizes.push({ number, orientation: size.orientation, valueMm });
  }
  const raaminfo: WorkspaceRaaminfo[] = [];
  for (const item of draft.raaminfo.slice(0, LIMIT)) {
    const number = clean(item.number, 40);
    const category = clean(item.category, 40);
    const text = clean(item.text, 160);
    if (!number || !text || !(category in RAAMINFO_OPTIONS)) continue;
    const allowed = RAAMINFO_OPTIONS[category];
    if (category !== "Eigen tekst" && !allowed.includes(text)) continue;
    raaminfo.push({ number, category, text });
  }
  const pageRotations: PageRotation[] = [];
  const seenRotation = new Set<string>();
  for (const item of (draft.pageRotations ?? []).slice(0, LIMIT)) {
    const planName = canonicalPlan(item.planName, planNames);
    const page = pageIndex(item.page);
    const degrees = quarterTurn(item.degrees);
    if (!planName || page == null || !degrees) continue;
    const key = `${planName}\n${page}`;
    if (seenRotation.has(key)) continue;
    seenRotation.add(key);
    pageRotations.push({ planName, page, degrees });
  }
  return { drawings, openings, facades, sizes, raaminfo, pageRotations };
}

function projectType(group: string | null): "Nieuwbouw" | "Renovatie" | null {
  if (group === "NIEUWBOUW") return "Nieuwbouw";
  if (group === "RENOVATIE") return "Renovatie";
  return null;
}

/** Desktop documents[].page_rotations. Only plans with a turned page are written. */
function rotationDocuments(rotations: readonly PageRotation[], planNames: readonly string[]): Record<string, unknown>[] {
  return planNames.flatMap((name) => {
    const pages = rotations.filter((item) => item.planName === name);
    if (!pages.length) return [];
    const last = Math.max(...pages.map((item) => item.page));
    const pageRotations = Array.from({ length: last + 1 }, (_, index) => (
      pages.find((item) => item.page === index)?.degrees ?? 0
    ));
    return [{ name, original_path: name, page_rotations: pageRotations }];
  });
}

/**
 * project.json for a .tc-raam. Project fields come from the dossier.
 * The draft only adds drawings, numbers, sizes, raaminfo and page rotation.
 */
export function buildRaamstudioPayload(
  prefill: DossierPrefill,
  draft: WorkspaceDraft,
  planNames: readonly string[],
  step: WorkspaceStepId = "tekeningen",
): Record<string, unknown> {
  const work = normalizeDraft(draft, planNames);
  const details = {
    project_name: clean(prefill.name, 200),
    project_number: "",
    customer: clean(prefill.customer, 200),
    site_address: clean(prefill.siteAddress, 300),
    postal_city: "",
    contact: clean(prefill.contact, 200),
    project_leader: "",
    planned_date: "",
    seller: clean(prefill.seller, 200),
    notes: "",
    team: "",
  };
  const planNameSet = [...new Set(work.drawings.map((item) => item.planName).concat(
    work.openings.map((item) => item.planName),
    work.facades.map((item) => item.planName),
  ))];
  const payload: Record<string, unknown> = {
    format: RAAMSTUDIO_FORMAT,
    format_version: 1,
    application: "Thielemans & Co RaamStudio",
    app_version: RAAMSTUDIO_APP_VERSION,
    project_details: details,
    customer_choices: {},
    sources: planNameSet.map((name) => ({ name, original_path: name })),
    documents: rotationDocuments(work.pageRotations, planNames),
    selections: work.drawings.map((drawing) => ({
      source: drawing.planName,
      page_index: drawing.page ?? 0,
      ...(drawing.rect
        ? {
            rect: [
              drawing.rect.x,
              drawing.rect.y,
              roundUnit(drawing.rect.x + drawing.rect.w),
              roundUnit(drawing.rect.y + drawing.rect.h),
            ],
            rect_unit: "normalized",
          }
        : {}),
      kind: drawing.kind,
      name: drawing.name,
    })),
    tilo_drawings: work.drawings.map((drawing) => ({
      name: drawing.name,
      kind: drawing.kind,
      plan_name: drawing.planName,
      ...(drawing.page ? { page: drawing.page } : {}),
      ...(drawing.rect ? { rect: drawing.rect } : {}),
    })),
    window_markers: work.openings.map((opening) => placedMarker({
      source: opening.planName,
      page_index: opening.page ?? 0,
      floor: opening.floor,
      number: opening.number,
      selection_index: -1,
    }, opening.x, opening.y, opening.rect)),
    facade_markers: work.facades.map((facade) => placedMarker({
      source: facade.planName,
      page_index: facade.page ?? 0,
      number: facade.number,
      selection_index: -1,
    }, facade.x, facade.y)),
    dimension_scales: {},
    dimensions: work.sizes.map((size) => ({
      number: size.number,
      orientation: size.orientation,
      value_mm: size.valueMm,
      selection_index: -1,
    })),
    window_info_annotations: work.raaminfo.map((item) => ({
      number: item.number,
      category: item.category,
      text: item.text,
      selection_index: -1,
    })),
    window_info_sketches: [],
    custom_window_info_options: work.raaminfo
      .filter((item) => item.category === "Eigen tekst")
      .map((item) => item.text),
    active_floor: work.openings.at(-1)?.floor ?? "0",
    active_step: desktopStepIndex(step),
  };
  const type = projectType(prefill.projectGroup);
  if (type) payload.project_type = type;
  return payload;
}

function markPlace(marker: Record<string, unknown>): { page?: number; x?: number; y?: number; rect?: NormRect } {
  if (marker.coord !== "normalized") return {};
  const x = unit(marker.x);
  const y = unit(marker.y);
  const rect = normRect(
    marker.x0 != null && marker.y0 != null && marker.x1 != null && marker.y1 != null
      ? [marker.x0, marker.y0, marker.x1, marker.y1]
      : null,
  );
  const page = pageNumber(marker.page_index);
  return {
    ...(page ? { page } : {}),
    ...(x != null && y != null ? { x, y } : {}),
    ...(rect ? { rect } : {}),
  };
}

function placedMarker(
  marker: Record<string, unknown>,
  x: number | undefined,
  y: number | undefined,
  rect?: NormRect,
): Record<string, unknown> {
  const placed = { ...marker };
  if (x != null && y != null) {
    placed.x = x;
    placed.y = y;
    placed.label_x = x;
    placed.label_y = y;
    placed.coord = "normalized";
  }
  if (rect) {
    placed.x0 = rect.x;
    placed.y0 = rect.y;
    placed.x1 = roundUnit(rect.x + rect.w);
    placed.y1 = roundUnit(rect.y + rect.h);
    placed.coord = "normalized";
  }
  return placed;
}

function planFromSource(source: unknown, planNames: readonly string[]): string | null {
  if (typeof source !== "string") return null;
  return canonicalPlan(baseName(source), planNames);
}

/** Restore a workspace from project.json. Unknown plans stay out. */
export function workspaceFromPayload(payload: unknown, planNames: readonly string[]): WorkspaceDraft {
  if (!isRecord(payload) || payload.format !== RAAMSTUDIO_FORMAT) return EMPTY_DRAFT;
  const storedDrawings = records(payload.tilo_drawings);
  const drawingRecords = storedDrawings.length ? storedDrawings : records(payload.selections);
  const drawings: WorkspaceDrawing[] = [];
  for (const drawing of drawingRecords) {
    const planSource = drawing.plan_name ?? drawing.source;
    const planName = typeof planSource === "string" ? canonicalPlan(baseName(planSource), planNames) : null;
    const name = clean(drawing.name, 120);
    const kind = clean(drawing.kind, 40);
    if (!planName || !name || !DRAWING_KINDS.includes(kind as (typeof DRAWING_KINDS)[number])) continue;
    const normalized = drawing.rect_unit === "normalized" || drawing.coord === "normalized" || storedDrawings.length > 0;
    const rect = normalized ? normRect(drawing.rect) : null;
    const page = pageNumber(drawing.page ?? drawing.page_index);
    drawings.push({ planName, kind, name, ...(page ? { page } : {}), ...(rect ? { rect } : {}) });
  }
  const openings: WorkspaceOpening[] = records(payload.window_markers).flatMap((marker) => {
    const planName = planFromSource(marker.source, planNames);
    const number = clean(marker.number, 40);
    if (!planName || !number) return [];
    return [{ planName, floor: clean(marker.floor, 12) || "0", number, ...markPlace(marker) }];
  });
  const facades: WorkspaceFacade[] = records(payload.facade_markers).flatMap((marker) => {
    const planName = planFromSource(marker.source, planNames);
    const number = clean(marker.number, 40);
    if (!planName || !number) return [];
    return [{ planName, number, ...markPlace(marker) }];
  });
  const sizes: WorkspaceSize[] = records(payload.dimensions).flatMap((dimension) => {
    const number = clean(dimension.number, 40);
    const valueMm = millimetres(dimension.value_mm);
    const orientation = dimension.orientation === "width" || dimension.orientation === "height"
      ? dimension.orientation
      : null;
    if (!number || !valueMm || !orientation) return [];
    return [{ number, orientation, valueMm }];
  });
  const raaminfo: WorkspaceRaaminfo[] = records(payload.window_info_annotations).flatMap((item) => {
    const number = clean(item.number, 40);
    const category = clean(item.category, 40);
    const text = clean(item.text, 160);
    if (!number || !text || !(category in RAAMINFO_OPTIONS)) return [];
    return [{ number, category, text }];
  });
  const pageRotations: PageRotation[] = records(payload.documents).flatMap((document) => {
    const source = document.name ?? document.original_path;
    const planName = typeof source === "string" ? canonicalPlan(baseName(source), planNames) : null;
    if (!planName || !Array.isArray(document.page_rotations)) return [];
    return document.page_rotations.flatMap((value, page) => {
      const degrees = quarterTurn(value);
      if (!degrees) return [];
      return [{ planName, page, degrees }];
    });
  });
  return normalizeDraft({ drawings, openings, facades, sizes, raaminfo, pageRotations }, planNames);
}
