import { measuresFromSheets, pageUnit, type PlanSheet, type PlanWord } from "../opening-measures";

function sheet(name: string, words: PlanWord[], width = 600, height = 800): PlanSheet {
  return { name, width, height, words };
}

function word(text: string, x: number, y: number, rotated = false): PlanWord {
  return { text, x, y, rotated };
}

describe("opening measures", () => {
  const mark = { number: "1.2", x: 0.5, y: 0.5 };

  it("reads centimetres when the sheet is not full of four-digit figures", () => {
    expect(pageUnit([word("90", 0, 0), word("146", 0, 0), word("100", 0, 0), word("1173", 0, 0)])).toBe("cm");
    expect(pageUnit([word("1680", 0, 0), word("1335", 0, 0), word("2500", 0, 0)])).toBe("mm");
  });

  it("reads one dimension above the number and leaves two close ones empty", () => {
    const clear = sheet("+1", [word("90", 300, 430), word("14", 300, 450)]);
    const ambiguous = sheet("+1", [word("90", 300, 430), word("120", 300, 440)]);
    const result = measuresFromSheets({
      floors: [
        { sheet: clear, marks: [mark] },
        { sheet: ambiguous, marks: [{ number: "1.3", x: 0.5, y: 0.5 }] },
      ],
      facades: [],
    });
    expect(result.find((item) => item.number === "1.2")).toMatchObject({
      onFacade: false,
      width: { mm: 900, method: "gelezen", plan: "+1" },
      height: null,
    });
    expect(result.find((item) => item.number === "1.3")?.width).toBeNull();
  });

  it("takes the height from the facade and keeps a different plan width beside the facade width", () => {
    const floor = sheet("0", [word("110", 300, 430)]);
    const facade = sheet("Voorgevel", [
      word("90", 300, 430),
      word("235", 320, 400, true),
    ]);
    const [measure] = measuresFromSheets({
      floors: [{ sheet: floor, marks: [mark] }],
      facades: [{ sheet: facade, marks: [mark] }],
    });
    expect(measure).toMatchObject({
      onFacade: true,
      width: { mm: 900, method: "gelezen", plan: "Voorgevel" },
      planWidth: { mm: 1100, method: "gelezen", plan: "0" },
      height: { mm: 2350, method: "gelezen", plan: "Voorgevel" },
    });
  });

  it("ignores a room dimension and a height that is not beside the number", () => {
    const floor = sheet("0", [word("480", 300, 430)]);
    const facade = sheet("Achtergevel", [word("235", 500, 400, true)]);
    const [measure] = measuresFromSheets({
      floors: [{ sheet: floor, marks: [mark] }],
      facades: [{ sheet: facade, marks: [mark] }],
    });
    expect(measure?.width).toBeNull();
    expect(measure?.height).toBeNull();
  });
});
