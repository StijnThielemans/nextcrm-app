import { measuresFromSheets, pageUnit, type PlanLine, type PlanSheet, type PlanWord } from "../opening-measures";

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

  it("keeps the facade height and leaves the width empty when the two widths differ", () => {
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
      width: null,
      height: { mm: 2350, method: "gelezen", plan: "Voorgevel" },
    });
  });

  it("reads the figure on the dimension line that crosses the opening", () => {
    const scale = word("1/100", 10, 10);
    const line: PlanLine = { x0: 280, y0: 400, x1: 321, y1: 400 };
    const planned = sheet("0", [scale, word("146", 300, 406)], 600, 800);
    planned.lines = [line];
    const [measure] = measuresFromSheets({
      floors: [{ sheet: planned, marks: [mark] }],
      facades: [],
    });
    expect(measure?.width).toEqual({ mm: 1460, method: "gelezen", plan: "0" });
  });

  it("reads a metre figure with a comma and ignores a second line just as close", () => {
    const scale = word("schaal 1:50", 10, 10);
    const open: PlanLine = { x0: 259, y0: 408, x1: 342, y1: 408 };
    const other: PlanLine = { x0: 256, y0: 405, x1: 344, y1: 405 };
    const planned = sheet("+1", [scale, word("1,46", 300, 414), word("1,56", 300, 411)], 600, 800);
    planned.lines = [open, other];
    const [measure] = measuresFromSheets({
      floors: [{ sheet: planned, marks: [mark] }],
      facades: [],
    });
    expect(measure?.width).toBeNull();
  });

  it("uses the unrotated page when the sheet was turned", () => {
    const scale = word("1/100", 10, 10);
    const planned = sheet("0", [scale, word("90", 120, 246)], 600, 800);
    planned.lines = [{ x0: 107, y0: 240, x1: 133, y1: 240 }];
    planned.rotation = 90;
    const [measure] = measuresFromSheets({
      floors: [{ sheet: planned, marks: [{ number: "1.2", x: 0.3, y: 0.2 }] }],
      facades: [],
    });
    expect(measure?.width).toEqual({ mm: 900, method: "gelezen", plan: "0" });
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
