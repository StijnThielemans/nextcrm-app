import { buildRaamstudioPayload, sheetsForStep, type DossierPrefill, type WorkspaceDrawing } from "../workspace-model";

const deBacker = [
  { id: "plan-01", name: "De Backer  Anouchka PLAN 01.pdf" },
  { id: "plan-02", name: "De Backer  Anouchka PLAN 02.pdf" },
];

const named = [
  { id: "floor", name: "BA_herbouwen_P_N_+0_Boutens.pdf" },
  { id: "front", name: "BA_herbouwen_G_N_VG_Boutens.pdf" },
  { id: "section", name: "BA_herbouwen_S_N_AA_Boutens.pdf" },
];

const prefill: DossierPrefill = {
  number: "OFF-2026-0018",
  name: "De Backer Anouchka",
  customer: "De Backer Anouchka",
  siteAddress: "Merchtemsebaan 31",
  contact: "",
  seller: "Saerens Evi",
  projectGroup: "NIEUWBOUW",
};

describe("plan sheets without a saved selection", () => {
  it("shows the dossier plan files on Grondplan and on the facade steps", () => {
    const floor = sheetsForStep([], deBacker, "floor");
    const facade = sheetsForStep([], deBacker, "facade");
    expect(floor.fromFile).toBe(true);
    expect(facade.fromFile).toBe(true);
    expect(floor.sheets.map((sheet) => sheet.planId)).toEqual(["plan-01", "plan-02"]);
    expect(facade.sheets.map((sheet) => sheet.planName)).toEqual(deBacker.map((plan) => plan.name));
    expect(floor.sheets.every((sheet) => sheet.kind === "Plan" && sheet.rect.w === 1 && sheet.rect.h === 1)).toBe(true);
    expect(facade.sheets.every((sheet) => sheet.fromFile && sheet.index < 0)).toBe(true);
  });

  it("keeps a named grondplan off the facade step and a named gevel off Grondplan", () => {
    expect(sheetsForStep([], named, "floor").sheets.map((sheet) => sheet.planId)).toEqual(["floor"]);
    expect(sheetsForStep([], named, "facade").sheets.map((sheet) => sheet.planId)).toEqual(["front", "section"]);
    expect(sheetsForStep([], named, "facade").sheets.map((sheet) => sheet.kind)).toEqual(["Gevel", "Snede"]);
    expect(sheetsForStep([], [{ id: "only", name: "Voorgevel.pdf" }], "floor").sheets).toEqual([]);
  });

  it("keeps saved knipsels and their numbers, and does not invent a selection", () => {
    const drawings: WorkspaceDrawing[] = [
      { planName: "UV_Kevin & Anke_Plannen_17.11.26.pdf", kind: "Verdieping / grondplan", name: "0", rect: { x: 0.22, y: 0.08, w: 0.74, h: 0.72 } },
      { planName: "UV_Kevin & Anke_Plannen_17.11.26.pdf", kind: "Verdieping / grondplan", name: "+1", rect: { x: 0.2, y: 0.05, w: 0.75, h: 0.76 } },
      { planName: "UV_Kevin & Anke_Plannen_17.11.26.pdf", kind: "Verdieping / grondplan", name: "voorgevel", rect: { x: 0.31, y: 0.27, w: 0.46, h: 0.35 } },
    ];
    const plans = [{ id: "uv", name: "UV_Kevin & Anke_Plannen_17.11.26.pdf" }];
    const floor = sheetsForStep(drawings, plans, "floor");
    const facade = sheetsForStep(drawings, plans, "facade");
    expect(floor.fromFile).toBe(false);
    expect(facade.fromFile).toBe(false);
    expect(floor.sheets.map((sheet) => sheet.name)).toEqual(["0", "+1"]);
    expect(facade.sheets.map((sheet) => sheet.name)).toEqual(["voorgevel"]);
    expect(drawings).toHaveLength(3);
    const payload = buildRaamstudioPayload(prefill, {
      drawings: [],
      openings: [{ planName: plans[0].name, floor: "0", number: "0.1", x: 0.4, y: 0.5 }],
      facades: [],
      sizes: [{ number: "0.1", orientation: "width", valueMm: "1460" }],
      raaminfo: [],
      pageRotations: [],
    }, [plans[0].name]);
    expect(payload.selections).toEqual([]);
    expect(payload.dimensions).toEqual([{ number: "0.1", orientation: "width", value_mm: "1460", selection_index: -1 }]);
  });
});
