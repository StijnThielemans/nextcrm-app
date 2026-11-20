import { crc32, deflateRawSync } from "node:zlib";

import { readRaamstudioPayload, readRaamstudioProject } from "../read-project";
import { zipProjectJson } from "../project-archive";
import {
  buildRaamstudioPayload,
  nextWindowNumber,
  normalizeDraft,
  raamstudioDocumentName,
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
};

describe("RaamStudio workspace file", () => {
  it("numbers the next opening the way the desktop program does", () => {
    expect(nextWindowNumber(null, "0")).toBe("0.1");
    expect(nextWindowNumber("0.1", "0")).toBe("0.2");
    expect(nextWindowNumber("0.2a", "0")).toBe("0.2b");
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
