import { buildSalesDashboard, canSeeOtherSellers, sellerFilterParam, type DashDossier, type DashQuote } from "../dashboard-view";

const month = { start: "2026-11-01", end: "2026-11-22" };
const previous = { start: "2026-10-10", end: "2026-10-31" };
const today = "2026-11-22";

function quote(partial: Partial<DashQuote> & Pick<DashQuote, "id">): DashQuote {
  return {
    familyId: partial.id,
    version: 1,
    number: partial.id,
    bruto: null,
    wonAt: null,
    accepted: false,
    createdAt: "2026-11-19T10:00:00.000Z",
    ...partial,
  };
}

function dossier(partial: Partial<DashDossier> & Pick<DashDossier, "id" | "status">): DashDossier {
  return {
    number: partial.id,
    seller: "Haegeman Robbe",
    customer: "Klant",
    city: "Gent",
    postalCode: "9000",
    requestDate: "2026-11-19",
    wonAt: null,
    lostAt: null,
    quotes: [],
    sends: [],
    ...partial,
  };
}

function view(dossiers: DashDossier[], canSeeOthers = true, range = month) {
  return buildSalesDashboard({
    dossiers,
    preset: "maand",
    range,
    previous,
    today,
    canSeeOthers,
  });
}

describe("seller visibility", () => {
  it("lets an admin filter sellers and ignores the same query for a seller", () => {
    expect(canSeeOtherSellers({ name: "Admin", role: "admin" })).toBe(true);
    expect(sellerFilterParam({ name: "Admin", role: "admin" }, "Haegeman Robbe")).toBe("Haegeman Robbe");
    expect(sellerFilterParam({ name: "Admin", role: "admin" }, "geen")).toBe("none");
    expect(sellerFilterParam({ name: "Admin", role: "admin" }, "Iemand Anders")).toBeNull();
    expect(canSeeOtherSellers({ name: "Robbe Haegeman", role: "user" })).toBe(false);
    expect(sellerFilterParam({ name: "Robbe Haegeman", role: "user" }, "Van Doorslaer Merel")).toBeNull();
    expect(sellerFilterParam({ name: "Planner", role: "user" }, "Haegeman Robbe")).toBeNull();
  });
});

describe("dashboard figures", () => {
  it("sums marked won quotes once and leaves other versions out", () => {
    const model = view([
      dossier({
        id: "won",
        number: "OFF-WON",
        status: "GEWONNEN",
        wonAt: "2026-11-19T09:00:00.000Z",
        seller: "Haegeman Robbe",
        quotes: [
          quote({ id: "old", familyId: "fam", version: 1, bruto: 1000, number: "Q-oud" }),
          quote({ id: "current", familyId: "fam", version: 2, bruto: 1500, accepted: true, number: "Q-nu" }),
          quote({ id: "extra", familyId: "other", bruto: 40, wonAt: "2026-11-19T09:00:00.000Z", number: "Q-extra" }),
          quote({ id: "alt", familyId: "alt", bruto: 9999, number: "Q-alt" }),
        ],
        sends: [
          { quoteId: "old", sentAt: "2026-11-01T10:00:00.000Z" },
          { quoteId: "current", sentAt: "2026-11-19T11:00:00.000Z" },
        ],
      }),
    ]);
    expect(model.sold.amount).toBe(1540);
    expect(model.sold.count).toBe(1);
    expect(model.won.count).toBe(1);
    expect(model.average.amount).toBe(1540);
    expect(model.chart.empty).toBe(false);
    expect(model.chart.points.some((point) => point.amount === 1540)).toBe(true);
  });

  it("does not sell a lost dossier, even when its quotes stayed marked won", () => {
    const model = view([
      dossier({
        id: "lost",
        number: "OFF-2026-0014",
        status: "VERLOREN",
        seller: "Haegeman Robbe",
        wonAt: "2026-11-20T14:04:44.275Z",
        lostAt: "2026-11-20T14:16:35.977Z",
        quotes: [
          quote({ id: "a", bruto: 23441.59, accepted: true, wonAt: "2026-11-20T14:04:44.275Z", number: "A" }),
          quote({ id: "b", bruto: 13773.44, wonAt: "2026-11-20T14:06:24.865Z", number: "B" }),
        ],
        sends: [
          { quoteId: "a", sentAt: "2026-11-20T11:00:11.155Z" },
          { quoteId: "b", sentAt: "2026-11-20T13:39:37.705Z" },
        ],
      }),
    ]);
    expect(model.sold.amount).toBeNull();
    expect(model.sold.count).toBe(0);
    expect(model.wonLost.lostCount).toBe(1);
    expect(model.wonLost.lostAmount).toBe(37215.03);
    expect(model.conversion.percent).toBe(0);
    expect(model.conversion.closed).toBe(1);
    expect(model.fresh.amount).toBe(13773.44);
    expect(model.fresh.count).toBe(1);
  });

  it("counts one open quote per dossier and skips an unsent alternative", () => {
    const model = view([
      dossier({
        id: "open",
        status: "OFFERTE_VERSTUURD",
        quotes: [
          quote({ id: "sent", familyId: "fam", version: 2, bruto: 1500, number: "Q-2", createdAt: "2026-11-18T10:00:00.000Z" }),
          quote({ id: "old", familyId: "fam", version: 1, bruto: 1000, number: "Q-1", createdAt: "2026-11-10T10:00:00.000Z" }),
          quote({ id: "draft", familyId: "other", bruto: 9000, number: "Q-draft" }),
        ],
        sends: [{ quoteId: "sent", sentAt: "2026-11-19T12:00:00.000Z" }],
      }),
    ]);
    expect(model.open).toMatchObject({ amount: 1500, count: 1, unpriced: 0 });
    expect(model.fresh).toMatchObject({ amount: 1500, count: 1 });
  });

  it("leaves conversion empty when nothing was closed and does not invent a gross total", () => {
    const empty = view([dossier({ id: "new", status: "NIEUW" })]);
    expect(empty.conversion.percent).toBeNull();
    expect(empty.conversion.closed).toBe(0);
    expect(empty.momentum).toEqual(["Geen cijfers in deze periode."]);

    const unpriced = view([
      dossier({
        id: "won-blank",
        status: "GEWONNEN",
        wonAt: "2026-11-18T12:00:00.000Z",
        quotes: [quote({ id: "blank", accepted: true, bruto: null })],
      }),
    ]);
    expect(unpriced.sold.amount).toBeNull();
    expect(unpriced.sold.count).toBe(1);
    expect(unpriced.sold.unpriced).toBe(1);
    expect(unpriced.average.amount).toBeNull();
    expect(unpriced.chart.empty).toBe(true);
  });

  it("hides a colleague ranking from a seller and ranks an admin by sold gross", () => {
    const rows = [
      dossier({
        id: "robbe",
        status: "GEWONNEN",
        seller: "Haegeman Robbe",
        wonAt: "2026-11-19T09:00:00.000Z",
        quotes: [quote({ id: "r", bruto: 6220.65, accepted: true })],
      }),
      dossier({
        id: "evi",
        status: "GEWONNEN",
        seller: "Saerens Evi",
        wonAt: "2026-11-19T11:00:00.000Z",
        city: "Aalst",
        quotes: [quote({ id: "e", bruto: 3308.85, accepted: true })],
      }),
    ];
    const seller = view([rows[0]], false);
    expect(seller.ranking.rows).toEqual([]);
    expect(seller.ranking.empty).toMatch(/eigen cijfers/);
    expect(seller.bars.mode).toBe("self");
    expect(seller.bars.rows.map((row) => row.seller)).toEqual(["Haegeman Robbe"]);

    const admin = view(rows, true);
    expect(admin.ranking.rows.map((row) => row.seller)).toEqual(["Haegeman Robbe", "Saerens Evi"]);
    expect(admin.bars.mode).toBe("compare");
    expect(admin.record?.amount).toBe(6220.65);
    expect(seller.record).toBeNull();
  });

  it("notes an older open quote and a quote above the median, and groups municipalities", () => {
    const model = view(
      [
        dossier({
          id: "small",
          status: "OFFERTE_VERSTUURD",
          customer: "Klein",
          city: "Gent",
          seller: "Saerens Evi",
          quotes: [quote({ id: "s", bruto: 1000, number: "Q-S" })],
          sends: [{ quoteId: "s", sentAt: "2026-11-01T10:00:00.000Z" }],
        }),
        dossier({
          id: "mid",
          status: "OFFERTE_VERSTUURD",
          customer: "Midden",
          city: "Gent",
          seller: "Haegeman Robbe",
          quotes: [quote({ id: "m", bruto: 2000, number: "Q-M" })],
          sends: [{ quoteId: "m", sentAt: "2026-11-20T10:00:00.000Z" }],
        }),
        dossier({
          id: "big",
          status: "OFFERTE_VERSTUURD",
          customer: "Groot",
          city: null,
          postalCode: "1840",
          seller: "Van Doorslaer Merel",
          quotes: [quote({ id: "b", bruto: 9000, number: "Q-B" })],
          sends: [{ quoteId: "b", sentAt: "2026-11-20T10:00:00.000Z" }],
        }),
        dossier({
          id: "blank-place",
          status: "NIEUW",
          city: null,
          postalCode: null,
          requestDate: "2026-11-19",
        }),
      ],
      true,
    );
    const big = model.followUp.find((row) => row.id === "big");
    const small = model.followUp.find((row) => row.id === "small");
    expect(small?.daysOpen).toBeGreaterThan(7);
    expect(small?.notes).toContain("Langer dan 7 dagen open.");
    expect(big?.notes.some((note) => note.startsWith("Hoger dan de mediaan"))).toBe(true);
    expect(model.followUp.find((row) => row.id === "mid")?.notes).toEqual([]);
    expect(model.region.rows.map((row) => row.label)).toEqual(["Gent", "Postcode 1840", "Zonder plaats"]);
    expect(model.region.rows[0]?.count).toBe(2);
  });

  it("changes with the period and skips a percent against a zero previous amount", () => {
    const won = dossier({
      id: "won",
      status: "GEWONNEN",
      wonAt: "2026-11-19T09:00:00.000Z",
      quotes: [quote({ id: "q", bruto: 500, accepted: true })],
    });
    const inMonth = view([won]);
    const todayOnly = view([won], true, { start: "2026-11-22", end: "2026-11-22" });
    expect(inMonth.sold.amount).toBe(500);
    expect(inMonth.sold.delta).toBeNull();
    expect(todayOnly.sold.amount).toBeNull();
    expect(todayOnly.sold.count).toBe(0);
    expect(todayOnly.momentum).toEqual(["Geen cijfers in deze periode."]);
  });
});
