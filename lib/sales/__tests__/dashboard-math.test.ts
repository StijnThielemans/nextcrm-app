import { pickLatestSend, salesTiles, type DashRow } from "../dashboard-math";

const monthStart = "2026-11-01";
const monthEnd = "2026-12-01";
const today = "2026-11-18";

function row(partial: Partial<DashRow> & Pick<DashRow, "status">): DashRow {
  return {
    requestDate: null,
    followUpDate: null,
    wonAt: null,
    lostAt: null,
    acceptedSell: null,
    acceptedMargin: null,
    latestSentSell: null,
    latestSentMargin: null,
    ...partial,
  };
}

describe("pickLatestSend", () => {
  it("keeps the newest send and ignores an older alternative", () => {
    const latest = pickLatestSend([
      { sentAt: "2026-11-01T10:00:00.000Z", sell: 1000, margin: 200 },
      { sentAt: "2026-11-10T10:00:00.000Z", sell: 1500, margin: 300 },
    ]);
    expect(latest?.sell).toBe(1500);
  });
});

describe("salesTiles", () => {
  it("sums only the latest sent value per dossier and leaves the percent empty when nothing was sent", () => {
    const tiles = salesTiles(
      [
        row({ status: "OFFERTE_VERSTUURD", latestSentSell: 1500, latestSentMargin: 300, followUpDate: "2026-11-10" }),
        row({ status: "NIEUW" }),
        row({
          status: "GEWONNEN",
          wonAt: "2026-11-05",
          acceptedSell: 2000,
          acceptedMargin: 400,
          latestSentSell: 1800,
        }),
        row({ status: "VERLOREN", lostAt: "2026-11-06", latestSentSell: 500 }),
      ],
      monthStart,
      monthEnd,
      today,
    );
    expect(tiles.openCount).toBe(2);
    expect(tiles.openSell).toBe(1500);
    expect(tiles.openMargin).toBe(300);
    expect(tiles.openMarginPercent).toBe(20);
    expect(tiles.wonSell).toBe(2000);
    expect(tiles.lostSell).toBe(500);
    expect(tiles.followUpCount).toBe(1);
  });

  it("returns a null combined percent when open sell is 0", () => {
    const tiles = salesTiles([row({ status: "NIEUW" })], monthStart, monthEnd, today);
    expect(tiles.openSell).toBe(0);
    expect(tiles.openMarginPercent).toBeNull();
  });
});
