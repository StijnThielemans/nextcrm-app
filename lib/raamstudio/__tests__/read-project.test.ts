import { crc32, deflateRawSync } from "node:zlib";

import getCrmMenuItem from "@/app/[locale]/(routes)/components/menu-items/Crm";
import {
  INVALID_PROJECT,
  MISSING_PROJECT_JSON,
  NOT_A_ZIP,
  readRaamstudioProject,
} from "../read-project";

function zipProject(payload: unknown, method: 0 | 8): Uint8Array {
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  const data = method === 8 ? deflateRawSync(raw) : raw;
  const name = Buffer.from("project.json");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(crc32(raw), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(method, 10);
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
  return Buffer.concat([local, name, data, central, name, eocd]);
}

const nieuwbouw = {
  format: "thielemans-raamstudio-project",
  app_version: "0.18.1",
  project_details: {
    project_name: "Hofstraat",
    customer: "Peeters",
    site_address: "Hofstraat 1, 9000 Gent",
    postal_city: "",
    contact: "09 000 00 00",
    seller: "Robbe",
    notes: "hoekraam",
    project_number: "P-1",
    project_leader: "Johan",
    planned_date: "01/12/2026",
  },
  selections: [
    { name: "Gelijkvloers", kind: "Verdieping / grondplan" },
    { name: "Voorgevel", kind: "Gevel" },
  ],
  window_markers: [{ number: "0.2", selection_index: 0 }, { number: "0.1", selection_index: 0 }],
  facade_markers: [{ number: "0.1", selection_index: 1, height_mm_override: 2250 }],
  dimensions: [{ selection_index: 1, orientation: "width", value_mm: 1200 }],
  window_info_annotations: [{ selection_index: 1, text: "Rubber", category: "Onderaansluiting" }],
  customer_choices: { window_colour: "zwart" },
};

const renovatie = {
  format: "thielemans-raamstudio-project",
  project_type: "Renovatie",
  project_details: {
    project_name: "vermeulen-reno",
    project_type: "Renovatie",
    customer: "Vermeulen test",
    site_address: "Jozef Suvéestraat · 8000 Brugge",
    postal_city: "",
    contact: "1511616",
    seller: "Evi",
    notes: "",
  },
  renovation_measurements: [
    { number: "0.1", window_type: "Anders", width_mm: "2000", height_mm: "2500", note: "" },
    { number: "0.2", window_type: "Deur", width_mm: "980", height_mm: "2100", note: "opstap" },
  ],
  renovation_photos: [
    {
      name: "WhatsApp Image 2026-10-23 at 14.51.16 (1).jpeg",
      annotations: [{ number: "0.1" }],
      info_labels: [{ text: "Kruk+komgreep+Knopcilinder", x: 645.12, y: 1504.48 }],
    },
  ],
  renovation_windows: [
    { number: "0.1", photo_name: "WhatsApp Image 2026-10-23 at 14.51.16 (1).jpeg", renovation: true },
  ],
  report_photos: [
    { name: "werf.jpg", annotations: [{ number: "9.9" }], info_labels: [{ text: "niet uit werfverslag" }] },
  ],
  placement_bundle: { material_rows: [{ material: "Raam" }] },
};

describe("readRaamstudioProject", () => {
  it("reads nieuwbouw projectgegevens, numbers, sizes and raaminfo", async () => {
    const view = await readRaamstudioProject(zipProject(nieuwbouw, 8));
    expect(view.projectType).toBeNull();
    expect(view.details).toEqual([
      { label: "Projectnaam", value: "Hofstraat" },
      { label: "Klant / opdrachtgever", value: "Peeters" },
      { label: "Werfadres", value: "Hofstraat 1, 9000 Gent" },
      { label: "Contactpersoon / telefoon", value: "09 000 00 00" },
      { label: "Verkoper", value: "Robbe" },
      { label: "Opmerkingen", value: "hoekraam" },
    ]);
    expect(view.drawings).toEqual([
      { name: "Gelijkvloers", kind: "Verdieping / grondplan" },
      { name: "Voorgevel", kind: "Gevel" },
    ]);
    expect(view.positions).toEqual([
      {
        number: "0.1",
        places: ["Grondplan", "Gevels"],
        drawing: "Gelijkvloers · Voorgevel",
        windowType: null,
        widthMm: null,
        heightMm: "2250",
        note: null,
      },
      {
        number: "0.2",
        places: ["Grondplan"],
        drawing: "Gelijkvloers",
        windowType: null,
        widthMm: null,
        heightMm: null,
        note: null,
      },
    ]);
    expect(view.sizes).toEqual([{ orientation: "Breedte", valueMm: "1200", drawing: "Voorgevel" }]);
    expect(view.raaminfo).toEqual([
      { text: "Rubber", category: "Onderaansluiting", drawing: "Voorgevel", number: null },
    ]);
    expect(JSON.stringify(view)).not.toContain("Johan");
    expect(JSON.stringify(view)).not.toContain("zwart");
  });

  it("reads a renovation project and leaves werf photos out", async () => {
    const view = await readRaamstudioProject(zipProject(renovatie, 0));
    expect(view.projectType).toBe("Renovatie");
    expect(view.details.find((detail) => detail.label === "Werfadres")?.value).toBe(
      "Jozef Suvéestraat · 8000 Brugge",
    );
    expect(view.positions).toEqual([
      {
        number: "0.1",
        places: ["Werffoto\u2019s nummeren"],
        drawing: "WhatsApp Image 2026-10-23 at 14.51.16 (1).jpeg",
        windowType: "Anders",
        widthMm: "2000",
        heightMm: "2500",
        note: null,
      },
      {
        number: "0.2",
        places: [],
        drawing: null,
        windowType: "Deur",
        widthMm: "980",
        heightMm: "2100",
        note: "opstap",
      },
    ]);
    expect(view.raaminfo).toEqual([
      {
        text: "Kruk+komgreep+Knopcilinder",
        category: null,
        drawing: "WhatsApp Image 2026-10-23 at 14.51.16 (1).jpeg",
        number: null,
      },
    ]);
    expect(JSON.stringify(view)).not.toContain("9.9");
    expect(JSON.stringify(view)).not.toContain("niet uit werfverslag");
    expect(JSON.stringify(view)).not.toContain("placement");
  });

  it("refuses a zip that is not a RaamStudio project", async () => {
    await expect(readRaamstudioProject(zipProject({ format: "other" }, 0))).rejects.toThrow(INVALID_PROJECT);
  });

  it("refuses a zip without project.json and a file that is not a zip", async () => {
    const raw = Buffer.from("{}", "utf8");
    const name = Buffer.from("notes.txt");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(raw.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(raw.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(central.length + name.length, 12);
    eocd.writeUInt32LE(local.length + name.length + raw.length, 16);
    const zip = Buffer.concat([local, name, raw, central, name, eocd]);
    await expect(readRaamstudioProject(zip)).rejects.toThrow(MISSING_PROJECT_JSON);
    await expect(readRaamstudioProject(Buffer.from("geen zip"))).rejects.toThrow(NOT_A_ZIP);
  });
});

describe("RaamStudio menu", () => {
  it("adds one sidebar item and leaves the sales items in place", () => {
    const item = getCrmMenuItem({
      localizations: {
        title: "Verkoop",
        dashboard: "Dashboard",
        customers: "Klanten",
        dossiers: "Offertedossiers",
        quotes: "Offertes",
        offertebox: "Offertebox",
      },
    });
    expect(item.items?.map((entry) => [entry.title, entry.url])).toEqual([
      ["Dashboard", "/crm/dashboard"],
      ["Klanten", "/crm/accounts"],
      ["Offertedossiers", "/crm/dossiers"],
      ["Offertes", "/crm/offertes"],
      ["Offertebox", "/crm/offertebox"],
      ["RaamStudio", "/crm/raamstudio"],
    ]);
  });
});
