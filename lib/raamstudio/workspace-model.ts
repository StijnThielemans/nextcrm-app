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
  { id: "pdfs", label: "PDF's", hint: "De plannen van het dossier staan klaar." },
  { id: "tekeningen", label: "Tekeningen", hint: "Geef het open plan een type en een naam." },
  { id: "grondplan", label: "Grondplan", hint: "Duid de raamopeningen aan op het grondplan." },
  { id: "gevels", label: "Gevels", hint: "Zet de raamnummers op de gevel of de snede." },
  { id: "maten", label: "Maten", hint: "Vul breedte en hoogte in millimeter in." },
  { id: "raaminfo", label: "Raaminfo", hint: "Kies raaminfo bij het raamnummer." },
] as const;

export type WorkspaceStepId = (typeof WORKSPACE_STEPS)[number]["id"];

export type WorkspaceDrawing = { planName: string; kind: string; name: string };
export type WorkspaceOpening = { planName: string; floor: string; number: string };
export type WorkspaceFacade = { planName: string; number: string };
export type WorkspaceSize = { number: string; orientation: "width" | "height"; valueMm: string };
export type WorkspaceRaaminfo = { number: string; category: string; text: string };

export type WorkspaceDraft = {
  drawings: WorkspaceDrawing[];
  openings: WorkspaceOpening[];
  facades: WorkspaceFacade[];
  sizes: WorkspaceSize[];
  raaminfo: WorkspaceRaaminfo[];
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

export function openingStep(plans: { name: string; kind: string }[]): WorkspaceStepId {
  const pdfs = plans.filter((plan) => plan.kind === "plan");
  return pdfs.some((plan) => /grondplan/i.test(plan.name)) ? "grondplan" : "pdfs";
}

export function planForStep<T extends { name: string; kind: string }>(
  plans: T[],
  step: WorkspaceStepId,
): T | null {
  const pdfs = plans.filter((plan) => plan.kind === "plan");
  if (!pdfs.length) return null;
  if (step === "gevels") return pdfs.find((plan) => /gevel|snede/i.test(plan.name)) ?? pdfs[0];
  if (step === "grondplan" || step === "tekeningen") {
    return pdfs.find((plan) => /grondplan/i.test(plan.name)) ?? pdfs[0];
  }
  return pdfs[0];
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
    drawings.push({ planName, kind: drawing.kind, name });
  }
  const openings: WorkspaceOpening[] = [];
  for (const opening of draft.openings.slice(0, LIMIT)) {
    const planName = canonicalPlan(opening.planName, planNames);
    const number = clean(opening.number, 40);
    if (!planName || !number) continue;
    openings.push({ planName, floor: clean(opening.floor, 12) || "0", number });
  }
  const facades: WorkspaceFacade[] = [];
  for (const facade of draft.facades.slice(0, LIMIT)) {
    const planName = canonicalPlan(facade.planName, planNames);
    const number = clean(facade.number, 40);
    if (!planName || !number) continue;
    facades.push({ planName, number });
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
  return { drawings, openings, facades, sizes, raaminfo };
}

function projectType(group: string | null): "Nieuwbouw" | "Renovatie" | null {
  if (group === "NIEUWBOUW") return "Nieuwbouw";
  if (group === "RENOVATIE") return "Renovatie";
  return null;
}

/**
 * project.json for a .tc-raam. Project fields come from the dossier.
 * The draft only adds drawings, numbers, sizes and raaminfo.
 */
export function buildRaamstudioPayload(
  prefill: DossierPrefill,
  draft: WorkspaceDraft,
  planNames: readonly string[],
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
    documents: [],
    selections: [],
    tilo_drawings: work.drawings.map((drawing) => ({
      name: drawing.name,
      kind: drawing.kind,
      plan_name: drawing.planName,
    })),
    window_markers: work.openings.map((opening) => ({
      source: opening.planName,
      page_index: 0,
      floor: opening.floor,
      number: opening.number,
      selection_index: -1,
    })),
    facade_markers: work.facades.map((facade) => ({
      source: facade.planName,
      page_index: 0,
      number: facade.number,
      selection_index: -1,
    })),
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
    active_step: 3,
  };
  const type = projectType(prefill.projectGroup);
  if (type) payload.project_type = type;
  return payload;
}

function planFromSource(source: unknown, planNames: readonly string[]): string | null {
  if (typeof source !== "string") return null;
  return canonicalPlan(baseName(source), planNames);
}

/** Restore a workspace from project.json. Unknown plans stay out. */
export function workspaceFromPayload(payload: unknown, planNames: readonly string[]): WorkspaceDraft {
  if (!isRecord(payload) || payload.format !== RAAMSTUDIO_FORMAT) return EMPTY_DRAFT;
  const drawings: WorkspaceDrawing[] = [];
  for (const drawing of records(payload.tilo_drawings)) {
    const planName = typeof drawing.plan_name === "string" ? canonicalPlan(drawing.plan_name, planNames) : null;
    const name = clean(drawing.name, 120);
    const kind = clean(drawing.kind, 40);
    if (!planName || !name || !DRAWING_KINDS.includes(kind as (typeof DRAWING_KINDS)[number])) continue;
    drawings.push({ planName, kind, name });
  }
  const openings: WorkspaceOpening[] = records(payload.window_markers).flatMap((marker) => {
    const planName = planFromSource(marker.source, planNames);
    const number = clean(marker.number, 40);
    if (!planName || !number) return [];
    return [{ planName, floor: clean(marker.floor, 12) || "0", number }];
  });
  const facades: WorkspaceFacade[] = records(payload.facade_markers).flatMap((marker) => {
    const planName = planFromSource(marker.source, planNames);
    const number = clean(marker.number, 40);
    if (!planName || !number) return [];
    return [{ planName, number }];
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
  return normalizeDraft({ drawings, openings, facades, sizes, raaminfo }, planNames);
}
