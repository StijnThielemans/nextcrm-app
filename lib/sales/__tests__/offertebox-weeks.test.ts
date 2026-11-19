import { addDays, isSameBrusselsWeek, staysUntilQuoteSent, weekStartKey } from "../offertebox-weeks";

describe("offertebox week", () => {
  it("keeps a request until a quote was sent", () => {
    expect(staysUntilQuoteSent(0)).toBe(true);
    expect(staysUntilQuoteSent(1)).toBe(false);
  });

  it("starts the Brussels week on Monday", () => {
    expect(weekStartKey(new Date("2026-11-19T12:00:00.000Z"))).toBe("2026-11-16");
    expect(weekStartKey(new Date("2026-11-22T22:30:00.000Z"))).toBe("2026-11-16");
    expect(weekStartKey(new Date("2026-11-23T00:30:00.000Z"))).toBe("2026-11-23");
  });

  it("treats Thursday and the following Sunday as the same week", () => {
    expect(isSameBrusselsWeek(new Date("2026-11-19T08:00:00.000Z"), new Date("2026-11-22T18:00:00.000Z"))).toBe(true);
    expect(addDays("2026-11-16", 7)).toBe("2026-11-23");
  });
});
