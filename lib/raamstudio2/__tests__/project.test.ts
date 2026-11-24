import { FACADE_ORDER } from "@/lib/raamstudio/facade-order";
import { assignThielemansNumbers, emptyProject, nextFacadeSide, nextOpeningNumber, parseRs2, raamstudio2FileName, serializeRs2 } from "../project";

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
      side: "voorgevel",
      planId: "plan",
      planName: "grond.pdf",
      page: 1,
      x: 0.2,
      y: 0.3,
    });
    const again = parseRs2(serializeRs2(project));
    expect(again.format).toBe("thielemans-raamstudio-2");
    expect(again.openings[0]?.number).toBe("0.10");
    expect(raamstudio2FileName("OFF-2026-0001")).toBe("Raamstudio 2.0.raamstudio");
    expect(() => parseRs2(JSON.stringify({ format: "thielemans-raamstudio-project" }))).toThrow(/geen Raamstudio 2/);
  });

  it("numbers a floor across the four facades and keeps 0.10 distinct from 0.1", () => {
    const sideOf = (index: number) => (index < 3 ? "voorgevel" : index < 5 ? "rechtergevel" : index < 8 ? "achtergevel" : "linkergevel") as const;
    const items = Array.from({ length: 11 }, (_, index) => ({ id: String(index), floor: "0", side: sideOf(index), along: index }));
    const numbers = assignThielemansNumbers(items);
    expect(numbers.get("0")).toBe("0.1");
    expect(numbers.get("3")).toBe("0.4");
    expect(numbers.get("9")).toBe("0.10");
    expect(numbers.get("10")).toBe("0.11");
    expect(numbers.get("0")).not.toBe(numbers.get("9"));
    const nextFloor = assignThielemansNumbers([{ id: "up", floor: "1", side: "voorgevel", along: 0 }]);
    expect(nextFloor.get("up")).toBe("1.1");
  });
});
