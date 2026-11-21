import { dossierOpenLabel, keepOpenOrder } from "../recent-opens";

describe("dossierOpenLabel", () => {
  it("joins the project number and the name", () => {
    expect(dossierOpenLabel("OFF-2026-0011", "Peirlinkc Nicolas")).toBe("OFF-2026-0011 Peirlinkc Nicolas");
  });

  it("keeps a single present part", () => {
    expect(dossierOpenLabel("OFF-2026-0011", "  ")).toBe("OFF-2026-0011");
    expect(dossierOpenLabel(null, "Peirlinkc Nicolas")).toBe("Peirlinkc Nicolas");
  });
});

describe("keepOpenOrder", () => {
  it("keeps newest-first order, skips missing records, and stops at five", () => {
    const ids = ["a", "gone", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
    const rows = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"].map((id) => ({ id, name: id }));
    expect(keepOpenOrder(ids, rows).map((row) => row.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("returns the opened records when fewer than five exist", () => {
    const rows = ["a", "b"].map((id) => ({ id, name: id }));
    expect(keepOpenOrder(["b", "a"], rows).map((row) => row.id)).toEqual(["b", "a"]);
  });
});
