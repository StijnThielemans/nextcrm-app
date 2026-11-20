import { MISSING_QUOTE_PRICE, quoteCanWin, quotePriceLabel, wonQuotesTotal } from "../quote-choice";

describe("winning quote price", () => {
  it("formats a stored totaal bruto in Dutch euros", () => {
    expect(quotePriceLabel(6220.65)).toBe("€\u00a06.220,65");
  });

  it("shows a missing amount and refuses that quote as the winner", () => {
    expect(quotePriceLabel(null)).toBe(MISSING_QUOTE_PRICE);
    expect(quoteCanWin(null)).toBe(false);
    expect(quoteCanWin(6220.65)).toBe(true);
  });

  it("adds the stored totals of the won quotes and leaves one quote as itself", () => {
    expect(wonQuotesTotal([23441.59, 13773.44])).toBe(37215.03);
    expect(quotePriceLabel(wonQuotesTotal([23441.59, 13773.44]))).toBe("€\u00a037.215,03");
    expect(wonQuotesTotal([23441.59])).toBe(23441.59);
    expect(wonQuotesTotal([])).toBeNull();
    expect(wonQuotesTotal([null])).toBeNull();
  });
});
