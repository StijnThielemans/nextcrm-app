/**
 * Read-only view of a RaamStudio calculatie project.
 *
 * A .tc-raam file is a zip. MainWindow.open_project and
 * WindowOverviewWindow.open_calc_project both require project.json with
 * format "thielemans-raamstudio-project". This reader uses the same check
 * and only returns fields those screens actually store.
 */

export const RAAMSTUDIO_FORMAT = "thielemans-raamstudio-project";

export const MISSING_PROJECT_JSON = "Dit bestand bevat geen project.json.";
export const INVALID_PROJECT = "Dit is geen geldig RaamStudio-calculatieproject (.tc-raam).";
export const UNREADABLE_PROJECT = "project.json kon niet worden gelezen.";
export const NOT_A_ZIP = "Dit bestand is geen zip.";

export class RaamstudioFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RaamstudioFileError";
  }
}

export type ProjectDetail = { label: string; value: string };

export type NumberedPosition = {
  number: string;
  /** Step names from MainWindow / RenovationCalculationWindow, in step order. */
  places: string[];
  /** selection name, or the renovation photo name. */
  drawing: string | null;
  windowType: string | null;
  widthMm: string | null;
  heightMm: string | null;
  note: string | null;
};

export type Drawing = { name: string; kind: string | null };

export type Size = {
  /** "Breedte" or "Hoogte" when orientation is width or height. */
  orientation: string | null;
  valueMm: string;
  drawing: string | null;
};

export type RaaminfoItem = {
  text: string;
  category: string | null;
  drawing: string | null;
  number: string | null;
};

export type RaamstudioProject = {
  projectType: string | null;
  details: ProjectDetail[];
  drawings: Drawing[];
  positions: NumberedPosition[];
  sizes: Size[];
  raaminfo: RaaminfoItem[];
};

const DETAIL_FIELDS: [string, string][] = [
  ["project_name", "Projectnaam"],
  ["customer", "Klant / opdrachtgever"],
  ["site_address", "Werfadres"],
  ["postal_city", "Postcode en gemeente"],
  ["contact", "Contactpersoon / telefoon"],
  ["seller", "Verkoper"],
  ["notes", "Opmerkingen"],
];

const GRONDPLAN = "Grondplan";
const GEVELS = "Gevels";
const WERFFOTO = "Werffoto\u2019s nummeren";
const PLACE_ORDER = [GRONDPLAN, GEVELS, WERFFOTO];

const MAX_PROJECT_JSON = 32 * 1024 * 1024;

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + bytes[offset + 1] * 0x100;
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] +
    bytes[offset + 1] * 0x100 +
    bytes[offset + 2] * 0x10000 +
    bytes[offset + 3] * 0x1000000
  ) >>> 0;
}

function findEocd(bytes: Uint8Array): number {
  const min = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= min; i -= 1) {
    if (u32(bytes, i) !== 0x06054b50) continue;
    if (i + 22 + u16(bytes, i + 20) === bytes.length) return i;
  }
  return -1;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readProjectJson(bytes: Uint8Array): Promise<unknown> {
  if (bytes.length < 22) throw new RaamstudioFileError(NOT_A_ZIP);
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new RaamstudioFileError(NOT_A_ZIP);
  const entries = u16(bytes, eocd + 10);
  const cdOffset = u32(bytes, eocd + 16);
  if (entries === 0xffff || cdOffset === 0xffffffff) {
    throw new RaamstudioFileError("Dit .tc-raam-bestand gebruikt Zip64. Deze proef leest dat nog niet.");
  }
  let cursor = cdOffset;
  let project: { method: number; compSize: number; localOffset: number } | null = null;
  for (let n = 0; n < entries; n += 1) {
    if (cursor + 46 > bytes.length || u32(bytes, cursor) !== 0x02014b50) {
      throw new RaamstudioFileError(NOT_A_ZIP);
    }
    const method = u16(bytes, cursor + 10);
    const compSize = u32(bytes, cursor + 20);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const localOffset = u32(bytes, cursor + 42);
    const name = new TextDecoder("utf-8").decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (name === "project.json") project = { method, compSize, localOffset };
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (!project) throw new RaamstudioFileError(MISSING_PROJECT_JSON);
  if ((project.method !== 0 && project.method !== 8) || project.compSize > MAX_PROJECT_JSON) {
    throw new RaamstudioFileError(UNREADABLE_PROJECT);
  }
  const local = project.localOffset;
  if (local + 30 > bytes.length || u32(bytes, local) !== 0x04034b50) {
    throw new RaamstudioFileError(UNREADABLE_PROJECT);
  }
  if (u16(bytes, local + 6) & 1) throw new RaamstudioFileError(UNREADABLE_PROJECT);
  const dataStart = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
  const dataEnd = dataStart + project.compSize;
  if (dataEnd > bytes.length) throw new RaamstudioFileError(UNREADABLE_PROJECT);
  const compressed = bytes.subarray(dataStart, dataEnd);
  let raw: Uint8Array;
  try {
    raw = project.method === 0 ? compressed : await inflateRaw(compressed);
  } catch {
    throw new RaamstudioFileError(UNREADABLE_PROJECT);
  }
  if (raw.byteLength > MAX_PROJECT_JSON) throw new RaamstudioFileError(UNREADABLE_PROJECT);
  try {
    return JSON.parse(new TextDecoder("utf-8").decode(raw));
  } catch {
    throw new RaamstudioFileError(UNREADABLE_PROJECT);
  }
}

function selectionName(selections: Record<string, unknown>[], index: unknown): string | null {
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0) return null;
  const selection = selections[index];
  return selection ? text(selection.name) : null;
}

function compareNumber(a: string, b: string): number {
  return a.localeCompare(b, "nl", { numeric: true, sensitivity: "base" });
}

type PositionDraft = {
  number: string;
  places: Set<string>;
  drawings: string[];
  windowType: string | null;
  widthMm: string | null;
  heightMm: string | null;
  note: string | null;
};

function position(map: Map<string, PositionDraft>, number: string): PositionDraft {
  const existing = map.get(number);
  if (existing) return existing;
  const created: PositionDraft = {
    number,
    places: new Set(),
    drawings: [],
    windowType: null,
    widthMm: null,
    heightMm: null,
    note: null,
  };
  map.set(number, created);
  return created;
}

function addDrawing(draft: PositionDraft, name: string | null) {
  if (name && !draft.drawings.includes(name)) draft.drawings.push(name);
}

function orientationLabel(value: unknown): string | null {
  const orientation = text(value);
  if (orientation === "width") return "Breedte";
  if (orientation === "height") return "Hoogte";
  return null;
}

export function raamstudioProjectFromPayload(payload: unknown): RaamstudioProject {
  if (!isRecord(payload) || payload.format !== RAAMSTUDIO_FORMAT) {
    throw new RaamstudioFileError(INVALID_PROJECT);
  }
  const detailsRecord = isRecord(payload.project_details) ? payload.project_details : {};
  const selections = records(payload.selections);
  const details = DETAIL_FIELDS.flatMap(([key, label]) => {
    const value = text(detailsRecord[key]);
    return value ? [{ label, value }] : [];
  });

  const drafts = new Map<string, PositionDraft>();
  for (const marker of records(payload.window_markers)) {
    const number = text(marker.number);
    if (!number) continue;
    const draft = position(drafts, number);
    draft.places.add(GRONDPLAN);
    addDrawing(draft, selectionName(selections, marker.selection_index));
  }
  for (const marker of records(payload.facade_markers)) {
    const number = text(marker.number);
    if (!number) continue;
    const draft = position(drafts, number);
    draft.places.add(GEVELS);
    addDrawing(draft, selectionName(selections, marker.selection_index));
    draft.widthMm ??= text(marker.width_mm_override);
    draft.heightMm ??= text(marker.height_mm_override);
  }
  for (const photo of records(payload.renovation_photos)) {
    const photoName = text(photo.name);
    for (const annotation of records(photo.annotations)) {
      const number = text(annotation.number);
      if (!number) continue;
      const draft = position(drafts, number);
      draft.places.add(WERFFOTO);
      addDrawing(draft, photoName);
    }
  }
  for (const opening of records(payload.renovation_windows)) {
    const number = text(opening.number);
    if (!number) continue;
    const draft = position(drafts, number);
    draft.places.add(WERFFOTO);
    addDrawing(draft, text(opening.photo_name));
  }
  for (const measure of records(payload.renovation_measurements)) {
    const number = text(measure.number);
    if (!number) continue;
    const draft = position(drafts, number);
    draft.windowType ??= text(measure.window_type);
    draft.widthMm ??= text(measure.width_mm);
    draft.heightMm ??= text(measure.height_mm);
    draft.note ??= text(measure.note);
  }

  const positions = [...drafts.values()]
    .sort((a, b) => compareNumber(a.number, b.number))
    .map((draft) => ({
      number: draft.number,
      places: PLACE_ORDER.filter((place) => draft.places.has(place)),
      drawing: draft.drawings.length ? draft.drawings.join(" · ") : null,
      windowType: draft.windowType,
      widthMm: draft.widthMm,
      heightMm: draft.heightMm,
      note: draft.note,
    }));

  const sizes = records(payload.dimensions).flatMap((dimension) => {
    const valueMm = text(dimension.value_mm);
    if (!valueMm) return [];
    return [{
      orientation: orientationLabel(dimension.orientation),
      valueMm,
      drawing: selectionName(selections, dimension.selection_index),
    }];
  });

  const raaminfo: RaaminfoItem[] = [];
  for (const note of records(payload.window_info_annotations)) {
    const label = text(note.text);
    if (!label) continue;
    raaminfo.push({
      text: label,
      category: text(note.category),
      drawing: selectionName(selections, note.selection_index),
      number: text(note.number) ?? text(note.window_number),
    });
  }
  for (const photo of records(payload.renovation_photos)) {
    const photoName = text(photo.name);
    for (const label of records(photo.info_labels)) {
      const labelText = text(label.text);
      if (!labelText) continue;
      raaminfo.push({
        text: labelText,
        category: text(label.category),
        drawing: photoName,
        number: text(label.window_number) ?? text(label.number),
      });
    }
  }

  return {
    projectType: text(payload.project_type) ?? text(detailsRecord.project_type),
    details,
    drawings: selections.flatMap((selection) => {
      const name = text(selection.name);
      return name ? [{ name, kind: text(selection.kind) }] : [];
    }),
    positions,
    sizes,
    raaminfo,
  };
}

export async function readRaamstudioProject(bytes: Uint8Array): Promise<RaamstudioProject> {
  return raamstudioProjectFromPayload(await readProjectJson(bytes));
}
