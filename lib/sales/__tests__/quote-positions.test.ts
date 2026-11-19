import { extractQuotePositions, type QuotePage } from "../quote-positions";

function run(text: string, x: number, y: number, width = text.length * 4.5, height = 9) {
  return { text, x, y, width, height };
}

/** Page 2 of a Logikal offer: two doors, a carry-over total, and the page footer. */
function doorPage(): QuotePage {
  return {
    pageNumber: 2,
    width: 595,
    height: 842,
    images: [
      { x: 0, y: 1, width: 594, height: 841 },
      { x: 62, y: 459, width: 107, height: 217 },
      { x: 62, y: 260, width: 107, height: 154 },
    ],
    items: [
      run("Positie", 62, 728, 33),
      run("Hoeveelheid", 133, 728, 59),
      run("0.1", 62, 697, 14),
      run("1,00 stuk(s) Deurelement 1440mm x 2600mm", 133, 697, 211),
      run("4.286,13", 422, 697, 39),
      run("4.286,13", 507, 697, 39),
      run("Deurelement 1440 mm x 2600 mm, bestaande uit een vast veld en een 1-vleugelige deur.", 175, 669, 300),
      run("Systeem:Reynaers MasterLine 8, HI (Cellular EPDM)", 175, 651, 189),
      run("Motorslot met vrij potentiaal contact", 175, 462, 126),
      run("0.2", 62, 435, 14),
      run("1,00 stuk(s) Deurelement 2710mm x 2600mm", 133, 435, 211),
      run("3.423,82", 422, 435, 39),
      run("3.423,82", 507, 435, 39),
      run("Deur 1-vleugelig naar binnen openend DIN R", 175, 353, 160),
      run("Werfcilinder", 175, 263, 43),
      run("Overdracht:", 420, 233, 52),
      run("7.709,95 €", 499, 233, 47),
      run("Offerte-Nr..: OFF-00000-00 van 01/01/2026", 59, 72, 180),
    ],
  };
}

describe("quote position blocks", () => {
  it("splits two doors into separate crops with quantity and Belgian price", () => {
    const blocks = extractQuotePositions([doorPage()]);
    expect(blocks.map((block) => block.number)).toEqual(["0.1", "0.2"]);
    expect(blocks[0]).toMatchObject({
      title: "Deurelement 1440mm x 2600mm",
      quantity: "1,00 stuk(s)",
      price: 4286.13,
    });
    expect(blocks[1]).toMatchObject({
      title: "Deurelement 2710mm x 2600mm",
      quantity: "1,00 stuk(s)",
      price: 3423.82,
    });
    expect(blocks[0].text).toContain("Reynaers MasterLine 8");
    expect(blocks[0].text).not.toContain("0.2");
    expect(blocks[1].text).toContain("DIN R");
    expect(blocks[1].text).not.toContain("Overdracht");

    const first = blocks[0].crop;
    const second = blocks[1].crop;
    expect(first.y).toBeGreaterThan(second.y + second.height);
    expect(first.y).toBeLessThanOrEqual(459);
    expect(first.y + first.height).toBeGreaterThan(697);
    expect(first.y + first.height).toBeLessThan(728);
    expect(second.y).toBeLessThanOrEqual(260);
    expect(second.y).toBeGreaterThan(233);
  });

  it("keeps a labelled option that is not a decimal position number", () => {
    const page: QuotePage = {
      pageNumber: 10,
      width: 595,
      height: 842,
      images: [{ x: 62, y: 117, width: 107, height: 113 }],
      items: [
        run("3.9", 62, 408, 14),
        run("1,00 stuk(s) Raamelement 2000mm x 2100mm", 133, 408, 200),
        run("2.200,65", 507, 408, 39),
        run("Raamelement 2000 mm x 2100 mm", 175, 380, 160),
        run("Optie Paniek", 62, 250, 55),
        run("1,00 stuk(s) Optie Paniek", 133, 250, 120),
        run("253,20", 431, 250, 32),
        run("Meerprijs Paniek slot", 175, 222, 90),
        run("Overdracht:", 420, 90, 52),
      ],
    };
    const blocks = extractQuotePositions([page]);
    expect(blocks.map((block) => block.number)).toEqual(["3.9", "Optie Paniek"]);
    expect(blocks[1].price).toBe(253.2);
    expect(blocks[1].title).toBe("Optie Paniek");
    expect(blocks[0].crop.y).toBeGreaterThan(250);
    expect(blocks[1].crop.y).toBeLessThanOrEqual(117);
    expect(blocks[1].crop.y).toBeGreaterThan(90);
  });

  it("returns nothing for a cover page and does not invent a position", () => {
    const page: QuotePage = {
      pageNumber: 1,
      width: 595,
      height: 842,
      images: [{ x: 59, y: 207, width: 90, height: 56 }],
      items: [
        run("OFFERTE", 50, 780, 60),
        run("Wij danken u voor uw prijsaanvraag", 50, 500, 200),
        run("1.1 in de inleiding is geen positie", 50, 400, 180),
      ],
    };
    expect(extractQuotePositions([page])).toEqual([]);
  });

  it("leaves the price empty when the position line has none", () => {
    const page: QuotePage = {
      pageNumber: 4,
      width: 595,
      height: 842,
      images: [],
      items: [
        run("4.1", 62, 500, 14),
        run("2,00 stuk(s) Raamelement 1000mm x 1000mm", 133, 500, 220),
        run("Vast raam", 175, 470, 50),
      ],
    };
    const blocks = extractQuotePositions([page]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].price).toBeNull();
    expect(blocks[0].quantity).toBe("2,00 stuk(s)");
  });
});
