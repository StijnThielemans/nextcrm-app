import { SalesError } from "../errors";
import { extractGrossTotal, parseGrossTotalInput } from "../gross-total";

const THIELEMANS = `
Totaal netto \t2.299,25 €
+ BTW (21,0%) \t482,84 €
Totaal bruto \t2.782,09 €
Betalingsvoorwaarden: \t14 dagen
`;

describe("extractGrossTotal", () => {
  it("reads Totaal bruto and ignores the net total and the VAT line", () => {
    expect(extractGrossTotal(THIELEMANS)).toBe("2782.09");
  });

  it("reads Totaal incl. BTW when there is no bruto line", () => {
    expect(extractGrossTotal("Totaal incl. BTW\n12.345,67 EUR")).toBe("12345.67");
    expect(extractGrossTotal("Totaal inclusief BTW: 999,50 €")).toBe("999.50");
    expect(extractGrossTotal("Totaal incl BTW 1.000,00")).toBe("1000.00");
  });

  it("prefers Totaal bruto over a later inclusive label", () => {
    expect(extractGrossTotal("Totaal bruto 10,00 €\nTotaal incl. BTW 99,00 €")).toBe("10.00");
  });

  it("uses the last bruto total when the header repeats", () => {
    expect(extractGrossTotal("Totaal bruto 1,00 €\nTotaal bruto 2.782,09 €")).toBe("2782.09");
  });

  it("accepts a space as the thousands separator", () => {
    expect(extractGrossTotal("Totaal bruto 12 345,67 €")).toBe("12345.67");
  });

  it("returns null when only a net total or no total is present", () => {
    expect(extractGrossTotal("Totaal netto 2.299,25 €")).toBeNull();
    expect(extractGrossTotal("Offerte zonder totaal\nPositie 1 100,00")).toBeNull();
    expect(extractGrossTotal("")).toBeNull();
  });
});

describe("parseGrossTotalInput", () => {
  it("accepts Belgian and canonical amounts", () => {
    expect(parseGrossTotalInput("2.782,09")).toBe("2782.09");
    expect(parseGrossTotalInput("€ 12.345,67")).toBe("12345.67");
    expect(parseGrossTotalInput("2782.09")).toBe("2782.09");
    expect(parseGrossTotalInput("2782,9")).toBe("2782.90");
    expect(parseGrossTotalInput("0,00")).toBe("0.00");
  });

  it("rejects an empty price, a negative price, and text", () => {
    expect(() => parseGrossTotalInput("  ")).toThrow(SalesError);
    expect(() => parseGrossTotalInput("")).toThrow(SalesError);
    try {
      parseGrossTotalInput(" ");
    } catch (error) {
      expect(error).toBeInstanceOf(SalesError);
      expect((error as SalesError).code).toBe("priceRequired");
    }
    expect(() => parseGrossTotalInput("-1")).toThrow(SalesError);
    expect(() => parseGrossTotalInput("abc")).toThrow(SalesError);
  });
});
