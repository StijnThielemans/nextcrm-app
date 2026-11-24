import { applyAutomatic, assembleStudio, classifyKind } from "../automatic";
import { emptyProject, type Rs2Project } from "../project";
import type { VisionBox } from "../proposals";

const box = (x: number, extra: Partial<VisionBox> = {}): VisionBox => ({
  x,
  y: 0.2,
  w: 0.05,
  h: 0.02,
  source: "pdfplumber",
  nearby: [],
  status: "te controleren",
  ...extra,
});

describe("automatic studio", () => {
  it("classifies plans, numbers across facades and keeps a written size", () => {
    let n = 0;
    const project = assembleStudio(
      [
        {
          planId: "g",
          planName: "gelijkvloers.pdf",
          page: 1,
          labels: [],
          openings: [box(0.1, { side: "voorgevel", widthMm: "2400" }), box(0.5, { side: "rechtergevel" })],
        },
        {
          planId: "v",
          planName: "voorgevel.pdf",
          page: 1,
          labels: [],
          openings: [box(0.3, { h: 0.08 })],
        },
      ],
      () => `id-${n++}`,
    );
    expect(classifyKind("snede-a.pdf", [])).toBe("Snede");
    expect(classifyKind("blad.pdf", ["achtergevel", "gelijkvloers"])).toBe("Grondplan");
    expect(classifyKind("voorgevel.pdf", [])).toBe("Gevel");
    expect(project.drawings.map((drawing) => drawing.kind)).toEqual(["Grondplan", "Gevel"]);
    expect(project.openings.map((opening) => opening.number)).toEqual(["0.1", "0.2"]);
    expect(project.openings[0]?.review).toBe("te controleren");
    expect(project.measures).toEqual([{ number: "0.1", widthMm: "2400", heightMm: "" }]);
    expect(project.facades.map((mark) => mark.openingNumber)).toEqual(["0.1"]);
    expect(project.highlights.length).toBeGreaterThan(0);
  });

  it("keeps a typed opening when the automatic pass runs again", () => {
    const existing = emptyProject();
    existing.openings.push({
      id: "hand",
      number: "0.10",
      floor: "0",
      side: "voorgevel",
      planId: "g",
      planName: "gelijkvloers.pdf",
      page: 1,
      x: 0.2,
      y: 0.2,
      review: null,
    });
    const fresh = emptyProject();
    fresh.openings.push({
      id: "auto",
      number: "0.10",
      floor: "0",
      side: "voorgevel",
      planId: "g",
      planName: "gelijkvloers.pdf",
      page: 1,
      x: 0.4,
      y: 0.2,
      review: "te controleren",
    });
    fresh.highlights.push({ id: "mark-auto", planId: "g", planName: "gelijkvloers.pdf", page: 1, x: 0.4, y: 0.2, w: 0.05, h: 0.02 });
    const merged = applyAutomatic(existing, fresh);
    expect(merged.openings.map((opening) => opening.id)).toEqual(["hand"]);
    expect(merged.openings[0]?.number).toBe("0.10");
  });

  it("does not use a fresh project type without the studio format", () => {
    const project: Rs2Project = assembleStudio([], () => "x");
    expect(project.format).toBe("thielemans-raamstudio-2");
  });
});
