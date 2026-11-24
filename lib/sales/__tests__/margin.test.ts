import { SalesError } from "../errors";
import { quoteMargin } from "../margin";

describe("quoteMargin", () => {
  it("computes margin and percent", () => {
    const result = quoteMargin("800", "1000", "21");
    expect(result.marginEuro.toString()).toBe("200");
    expect(result.marginPercent?.toString()).toBe("20");
  });

  it("allows a negative margin when the cost is higher than the sell price", () => {
    const result = quoteMargin("1200", "1000", "21");
    expect(result.marginEuro.toString()).toBe("-200");
    expect(result.marginPercent?.toString()).toBe("-20");
  });

  it("does not divide by zero when the sell price is 0", () => {
    const result = quoteMargin("0", "0", "21");
    expect(result.marginEuro.toString()).toBe("0");
    expect(result.marginPercent).toBeNull();
  });

  it("rounds to two decimals", () => {
    const result = quoteMargin("10.005", "30.004", "21.006");
    expect(result.cost.toString()).toBe("10.01");
    expect(result.sell.toString()).toBe("30");
    expect(result.vatRate.toString()).toBe("21.01");
    expect(result.marginEuro.toString()).toBe("19.99");
  });

  it("rejects a negative amount", () => {
    expect(() => quoteMargin("-1", "10", "21")).toThrow(SalesError);
  });

  it("rejects a vat rate above 100", () => {
    expect(() => quoteMargin("1", "10", "101")).toThrow(SalesError);
  });

  it("rejects text", () => {
    expect(() => quoteMargin("abc", "10", "21")).toThrow(SalesError);
  });
});
