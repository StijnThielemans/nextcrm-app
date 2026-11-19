import { MISSING_QUOTE_PRICE, quoteCanWin, quotePriceLabel } from "../quote-choice";

describe("winning quote price", () => {
  it("formats a stored totaal bruto in Dutch euros", () => {
    expect(quotePriceLabel(6220.65)).toBe("€\u00a06.220,65");
  });

  it("shows a missing amount and refuses that quote as the winner", () => {
    expect(quotePriceLabel(null)).toBe(MISSING_QUOTE_PRICE);
    expect(quoteCanWin(null)).toBe(false);
    expect(quoteCanWin(6220.65)).toBe(true);
  });
});
