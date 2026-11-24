/** One sent quote on a dossier. Several may be won at the same time. */
export type QuoteWinState = {
  id: string;
  sent: boolean;
  priced: boolean;
  /** The dossier's accepted quote. Its stored total stays the header amount. */
  accepted: boolean;
  /** Won on its own, without taking the accepted slot from another quote. */
  markedWon: boolean;
};

export type QuoteWinError = "missing" | "notSent" | "noPrice";

export function quoteIsWon(quote: QuoteWinState): boolean {
  return quote.accepted || quote.markedWon;
}

/**
 * Marking or clearing one quote leaves every other quote as it was.
 * The accepted quote stays put while it is still won, so its amount does not move.
 * Clearing the accepted quote hands that slot to another quote that is still won.
 */
export function applyQuoteWin(
  quotes: QuoteWinState[],
  quoteId: string,
  won: boolean,
  options: { requireSent: boolean },
): { quotes: QuoteWinState[]; error?: QuoteWinError } {
  const target = quotes.find((quote) => quote.id === quoteId);
  if (!target) return { quotes, error: "missing" };
  if (!won) {
    const cleared = quotes.map((quote) =>
      quote.id === quoteId ? { ...quote, accepted: false, markedWon: false } : quote,
    );
    if (cleared.some((quote) => quote.accepted)) return { quotes: cleared };
    const promote = cleared.find((quote) => quote.markedWon);
    if (!promote) return { quotes: cleared };
    return {
      quotes: cleared.map((quote) => (quote.id === promote.id ? { ...quote, accepted: true } : quote)),
    };
  }
  if (options.requireSent && !target.sent) return { quotes, error: "notSent" };
  if (!target.priced) return { quotes, error: "noPrice" };
  const anyAccepted = quotes.some((quote) => quote.accepted);
  return {
    quotes: quotes.map((quote) => {
      if (quote.id !== quoteId) return quote;
      return { ...quote, markedWon: true, accepted: quote.accepted || !anyAccepted };
    }),
  };
}

/** Gewonnen while at least one quote is won. The last clear returns to Offerte verstuurd. */
export function statusAfterWins(status: string | null, quotes: QuoteWinState[]): string | null {
  if (quotes.some(quoteIsWon)) return "GEWONNEN";
  if (status === "GEWONNEN") return "OFFERTE_VERSTUURD";
  return status;
}
