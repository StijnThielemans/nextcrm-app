import { applyQuoteWin, quoteIsWon, statusAfterWins, type QuoteWinState } from "../won-quotes";

function quote(id: string, extra: Partial<QuoteWinState> = {}): QuoteWinState {
  return { id, sent: true, priced: true, accepted: false, markedWon: false, ...extra };
}

describe("several quotes can be won together", () => {
  it("keeps the first won quote when a second sent quote is marked", () => {
    const first = quote("a", { accepted: true });
    const second = quote("b");
    const next = applyQuoteWin([first, second], "b", true, { requireSent: true });
    expect(next.error).toBeUndefined();
    expect(next.quotes.map((item) => [item.id, item.accepted, item.markedWon, quoteIsWon(item)])).toEqual([
      ["a", true, false, true],
      ["b", false, true, true],
    ]);
    expect(statusAfterWins("GEWONNEN", next.quotes)).toBe("GEWONNEN");
  });

  it("clears only the quote that was unmarked", () => {
    const first = quote("a", { accepted: true });
    const second = quote("b", { markedWon: true });
    const next = applyQuoteWin([first, second], "b", false, { requireSent: true });
    expect(next.quotes.filter(quoteIsWon).map((item) => item.id)).toEqual(["a"]);
    expect(next.quotes[0]?.accepted).toBe(true);
    expect(statusAfterWins("GEWONNEN", next.quotes)).toBe("GEWONNEN");
  });

  it("leaves the dossier won until the last quote is cleared", () => {
    const only = quote("a", { accepted: true, markedWon: true });
    const next = applyQuoteWin([only], "a", false, { requireSent: true });
    expect(next.quotes.some(quoteIsWon)).toBe(false);
    expect(statusAfterWins("GEWONNEN", next.quotes)).toBe("OFFERTE_VERSTUURD");
  });

  it("refuses an unsent quote and a quote without a gross total", () => {
    const rows = [quote("draft", { sent: false }), quote("blank", { priced: false })];
    expect(applyQuoteWin(rows, "draft", true, { requireSent: true }).error).toBe("notSent");
    expect(applyQuoteWin(rows, "blank", true, { requireSent: true }).error).toBe("noPrice");
    expect(rows.every((item) => !quoteIsWon(item))).toBe(true);
  });
});
