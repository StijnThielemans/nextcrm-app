import { FACADE_ORDER } from "@/lib/raamstudio/facade-order";
import { emptyProject, nextFacadeSide, nextOpeningNumber, parseRs2, raamstudio2FileName, serializeRs2 } from "../project";

describe("Raamstudio 2 project file", () => {
  it("keeps 0.1 and 0.10 apart and continues after the highest suffix", () => {
    expect(nextOpeningNumber("0", ["0.1", "0.10"])).toBe("0.11");
    expect(nextOpeningNumber("0", ["0.1"])).toBe("0.2");
    expect(nextOpeningNumber("1", ["0.10"])).toBe("1.1");
    expect("0.1" === "0.10").toBe(false);
  });

  it("walks facades from the street, counterclockwise", () => {
    expect(FACADE_ORDER).toEqual(["voorgevel", "rechtergevel", "achtergevel", "linkergevel"]);
    expect(nextFacadeSide([])).toBe("voorgevel");
    expect(nextFacadeSide(["voorgevel", "rechtergevel"])).toBe("achtergevel");
  });

  it("round-trips a project and refuses the old file format", () => {
    const project = emptyProject();
    project.openings.push({
      id: "a",
      number: "0.10",
      floor: "0",
      planId: "plan",
      planName: "grond.pdf",
      page: 1,
      x: 0.2,
      y: 0.3,
    });
    const again = parseRs2(serializeRs2(project));
    expect(again.format).toBe("thielemans-raamstudio-2");
    expect(again.openings[0]?.number).toBe("0.10");
    expect(raamstudio2FileName("OFF-2026-0001")).toBe("Raamstudio2 OFF-2026-0001.rs2");
    expect(() => parseRs2(JSON.stringify({ format: "thielemans-raamstudio-project" }))).toThrow(/geen Raamstudio 2/);
  });
});
