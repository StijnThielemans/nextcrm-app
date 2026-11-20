import { crc32, deflateRawSync } from "node:zlib";

import { readRaamstudioPayload, readRaamstudioProject } from "../read-project";
import { zipProjectJson } from "../project-archive";
import {
  WORKSPACE_STEPS,
  buildRaamstudioPayload,
  nextWindowNumber,
  normalizeDraft,
  openingStep,
  raamstudioDocumentName,
  stepFromActiveStep,
  rotatePlanPage,
  suggestedDrawingKind,
  suggestedDrawingName,
  workspaceFromPayload,
  type DossierPrefill,
  type WorkspaceDraft,
} from "../workspace-model";

const plans = ["PB681_Grondplannen.pdf", "PB681_Gevels en snedes.pdf"];

const prefill: DossierPrefill = {
  number: "OFF-2026-0014",
  name: "Hofstraat",
  customer: "Peeters",
  siteAddress: "Hofstraat 1, 9000 Gent",
  contact: "09 000 00 00",
  seller: "Haegeman Robbe",
  projectGroup: "NIEUWBOUW",
};

const draft: WorkspaceDraft = {
  drawings: [{ planName: plans[0], kind: "Verdieping / grondplan", name: "Gelijkvloers" }],
  openings: [{ planName: plans[0], floor: "0", number: "0.1" }],
  facades: [{ planName: plans[1], number: "0.1" }],
  sizes: [{ number: "0.1", orientation: "width", valueMm: "1200" }],
  raaminfo: [{ number: "0.1", category: "Onderaansluiting", text: "Rubber" }],
  pageRotations: [],
};

describe("RaamStudio workspace file", () => {
  it("numbers the next opening the way the desktop program does", () => {
    expect(nextWindowNumber(null, "0")).toBe("0.1");
    expect(nextWindowNumber("0.1", "0")).toBe("0.2");
    expect(nextWindowNumber("0.2a", "0")).toBe("0.2b");
  });

  it("opens on Tekeningen, where gevels are marked, and skips the PDF step", () => {
    expect(openingStep([{ name: "PB681_Grondplannen.pdf", kind: "plan" }])).toBe("tekeningen");
    expect(WORKSPACE_STEPS.map((step) => step.id)).toEqual(["tekeningen", "grondplan", "gevels", "maten", "raaminfo"]);
    expect(suggestedDrawingKind("BA_herbouwen_G_N_VG_Boutens.pdf")).toBe("Gevel");
    expect(suggestedDrawingKind("BA_herbouwen_S_N_AA_Boutens.pdf")).toBe("Snede");
    expect(suggestedDrawingName("BA_herbouwen_G_N_VG_Boutens.pdf")).toBe("Voorgevel");
    expect(suggestedDrawingName("BA_herbouwen_S_N_AA_Boutens.pdf")).toBe("Snede AA");
  });

  it("remembers the last workspace step and ignores a step this screen does not have", () => {
    expect(buildRaamstudioPayload(prefill, draft, plans, "gevels").active_step).toBe(5);
    expect(buildRaamstudioPayload(prefill, draft, plans, "grondplan").active_step).toBe(4);
    expect(buildRaamstudioPayload(prefill, draft, plans).active_step).toBe(3);
    expect(stepFromActiveStep(5)).toBe("gevels");
    expect(stepFromActiveStep(4)).toBe("grondplan");
    expect(stepFromActiveStep(3)).toBe("tekeningen");
    expect(stepFromActiveStep(1)).toBeNull();
    expect(stepFromActiveStep(undefined)).toBeNull();
  });

  it("names the dossier file as a RaamStudio project", () => {
    expect(raamstudioDocumentName("OFF-2026-0014")).toBe("RaamStudio OFF-2026-0014.tc-raam");
  });

  it("writes dossier fields and raamwerk, and leaves prices out", () => {
    const payload = buildRaamstudioPayload(prefill, {
      ...draft,
      openings: [
        ...draft.openings,
        { planName: "offerte.pdf", floor: "0", number: "9.9" },
        { planName: plans[0], floor: "0", number: "0.2", widthMm: "1" } as WorkspaceDraft["openings"][number],
      ],
      sizes: [...draft.sizes, { number: "0.1", orientation: "width", valueMm: "€ 10" }],
    }, plans);

    expect(payload.format).toBe("thielemans-raamstudio-project");
    expect(payload.project_type).toBe("Nieuwbouw");
    expect(payload.project_details).toMatchObject({
      project_name: "Hofstraat",
      customer: "Peeters",
      site_address: "Hofstraat 1, 9000 Gent",
      contact: "09 000 00 00",
      seller: "Haegeman Robbe",
    });
    expect(payload.window_markers).toEqual([
      { source: plans[0], page_index: 0, floor: "0", number: "0.1", selection_index: -1 },
      { source: plans[0], page_index: 0, floor: "0", number: "0.2", selection_index: -1 },
    ]);
    expect(payload.documents).toEqual([]);
    const json = JSON.stringify(payload);
    for (const key of ["cost_excl_vat", "sell_excl_vat", "total_bruto", "margin_euro", "vat_rate", "quoteMargin"]) {
      expect(json).not.toContain(key);
    }
  });

  it("does not force a calculatie type onto other project groups", () => {
    const payload = buildRaamstudioPayload({ ...prefill, projectGroup: "HAROL" }, draft, plans);
    expect(payload.project_type).toBeUndefined();
  });

  it("keeps a gevel mark and an opening on the drawing after save and reload", () => {
    const marked: WorkspaceDraft = {
      drawings: [{ planName: plans[1], kind: "Gevel", name: "Voorgevel", rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }],
      openings: [{ planName: plans[0], floor: "0", number: "0.1", x: 0.4, y: 0.5, rect: { x: 0.35, y: 0.45, w: 0.1, h: 0.08 } }],
      facades: [{ planName: plans[1], number: "0.1", x: 0.22, y: 0.33 }],
      sizes: [],
      raaminfo: [],
      pageRotations: [],
    };
    const dropped = normalizeDraft({
      ...marked,
      drawings: [...marked.drawings, { planName: plans[0], kind: "Gevel", name: "Zonder kader", rect: { x: 2, y: 0.2, w: 0.2, h: 0.2 } }],
    }, plans);
    expect(dropped.drawings[1]).toEqual({ planName: plans[0], kind: "Gevel", name: "Zonder kader" });
    const payload = buildRaamstudioPayload(prefill, marked, plans);
    expect(payload.selections).toEqual([
      {
        source: plans[1],
        page_index: 0,
        rect: [0.1, 0.2, 0.4, 0.6],
        rect_unit: "normalized",
        kind: "Gevel",
        name: "Voorgevel",
      },
    ]);
    expect(payload.window_markers).toEqual([
      {
        source: plans[0],
        page_index: 0,
        floor: "0",
        number: "0.1",
        selection_index: -1,
        x: 0.4,
        y: 0.5,
        label_x: 0.4,
        label_y: 0.5,
        coord: "normalized",
        x0: 0.35,
        y0: 0.45,
        x1: 0.45,
        y1: 0.53,
      },
    ]);
    expect(payload.facade_markers).toEqual([
      {
        source: plans[1],
        page_index: 0,
        number: "0.1",
        selection_index: -1,
        x: 0.22,
        y: 0.33,
        label_x: 0.22,
        label_y: 0.33,
        coord: "normalized",
      },
    ]);
    expect(workspaceFromPayload(payload, plans)).toEqual(normalizeDraft(marked, plans));
  });

  it("keeps a dragged measure label and does not turn it into a new size", () => {
    const moved: WorkspaceDraft = {
      ...draft,
      measurePlaces: [{ number: "0.1", orientation: "width", dx: 0.12, dy: -0.08 }],
    };
    const payload = buildRaamstudioPayload(prefill, moved, plans);
    expect(payload.tilo_measure_places).toEqual([{ number: "0.1", orientation: "width", dx: 0.12, dy: -0.08 }]);
    expect(payload.dimensions).toEqual([{ number: "0.1", orientation: "width", value_mm: "1200", selection_index: -1 }]);
    expect(workspaceFromPayload(payload, plans).measurePlaces).toEqual(moved.measurePlaces);
    expect(workspaceFromPayload(payload, plans).sizes).toEqual(draft.sizes);
  });

  it("turns one PDF page and keeps the kader and the number on that sheet", () => {
    const marked: WorkspaceDraft = {
      drawings: [
        { planName: plans[1], kind: "Gevel", name: "Voorgevel", rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } },
        { planName: plans[1], kind: "Snede", name: "Snede A", page: 1, rect: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 } },
      ],
      openings: [{ planName: plans[0], floor: "0", number: "0.1", x: 0.4, y: 0.5 }],
      facades: [{ planName: plans[1], number: "0.1", x: 0.22, y: 0.33 }],
      sizes: [{ number: "0.1", orientation: "width", valueMm: "1200" }],
      raaminfo: [],
      pageRotations: [],
    };
    const turned = rotatePlanPage(marked, plans[1], 0, 90);
    expect(turned.drawings[0].rect).toEqual({ x: 0.4, y: 0.1, w: 0.4, h: 0.3 });
    expect(turned.drawings[1]).toEqual(marked.drawings[1]);
    expect(turned.openings).toEqual(marked.openings);
    expect(turned.facades[0]).toMatchObject({ x: 0.67, y: 0.22 });
    expect(turned.sizes).toEqual(marked.sizes);
    expect(turned.pageRotations).toEqual([{ planName: plans[1], page: 0, degrees: 90 }]);

    const left = rotatePlanPage(marked, plans[1], 0, -90);
    expect(left.pageRotations).toEqual([{ planName: plans[1], page: 0, degrees: 270 }]);
    expect(left.drawings[0].rect).toEqual({ x: 0.2, y: 0.6, w: 0.4, h: 0.3 });

    let full = marked;
    for (let step = 0; step < 4; step += 1) full = rotatePlanPage(full, plans[1], 0, 90);
    expect(full.pageRotations).toEqual([]);
    expect(full.drawings[0].rect).toEqual(marked.drawings[0].rect);
    expect(full.facades[0]).toMatchObject({ x: 0.22, y: 0.33 });

    const payload = buildRaamstudioPayload(prefill, turned, plans);
    expect(payload.documents).toEqual([
      { name: plans[1], original_path: plans[1], page_rotations: [90] },
    ]);
    expect(payload.project_details).toMatchObject({ seller: "Haegeman Robbe", site_address: "Hofstraat 1, 9000 Gent" });
    expect(JSON.stringify(payload)).not.toContain("total_bruto");
    expect(workspaceFromPayload(payload, plans).pageRotations).toEqual(turned.pageRotations);
    expect(workspaceFromPayload(payload, plans).drawings[0].rect).toEqual(turned.drawings[0].rect);
  });

  it("round-trips a .tc-raam the reader already accepts", async () => {
    const bytes = zipProjectJson(buildRaamstudioPayload(prefill, draft, plans));
    const view = await readRaamstudioProject(bytes);
    expect(view.projectType).toBe("Nieuwbouw");
    expect(view.positions.map((position) => position.number)).toEqual(["0.1"]);
    expect(view.details.find((detail) => detail.label === "Verkoper")?.value).toBe("Haegeman Robbe");
    expect(view.sizes).toEqual([{ orientation: "Breedte", valueMm: "1200", drawing: null }]);
    expect(view.raaminfo).toEqual([
      { text: "Rubber", category: "Onderaansluiting", drawing: null, number: "0.1" },
    ]);

    const payload = await readRaamstudioPayload(bytes);
    expect(workspaceFromPayload(payload, plans)).toEqual(normalizeDraft(draft, plans));
  });

  it("still reads a stored zip entry", async () => {
    const raw = Buffer.from(JSON.stringify({ format: "thielemans-raamstudio-project", project_details: {} }), "utf8");
    const data = deflateRawSync(raw);
    const name = Buffer.from("project.json");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(central.length + name.length, 12);
    eocd.writeUInt32LE(local.length + name.length + data.length, 16);
    const zip = Buffer.concat([local, name, data, central, name, eocd]);
    await expect(readRaamstudioProject(zip)).resolves.toMatchObject({ positions: [] });
  });
});
