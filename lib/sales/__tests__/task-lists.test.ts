import { dossierTaskKind } from "../task-lists";

const now = new Date("2026-11-19T12:00:00.000Z");
const today = "2026-11-19";

function kind(partial: Partial<Parameters<typeof dossierTaskKind>[0]> & Pick<Parameters<typeof dossierTaskKind>[0], "status" | "hasDocuments">) {
  return dossierTaskKind({
    sentAt: null,
    followUpDate: null,
    now,
    today,
    ...partial,
  });
}

describe("sales task lists", () => {
  it("puts a new dossier without documents on the list still to make", () => {
    expect(kind({ status: "NIEUW", hasDocuments: false })).toBe("toMake");
  });

  it("puts a dossier that already holds documents on the in-progress list", () => {
    expect(kind({ status: "NIEUW", hasDocuments: true })).toBe("inProgress");
    expect(kind({ status: "OFFERTE_VERSTUURD", hasDocuments: true, sentAt: "2026-11-18T10:00:00.000Z" })).toBe("inProgress");
  });

  it("asks for follow-up 14 days after the quote was sent", () => {
    expect(kind({ status: "OFFERTE_VERSTUURD", hasDocuments: true, sentAt: "2026-11-05T10:00:00.000Z" })).toBe("followUp");
  });

  it("keeps a quote sent one week ago off the follow-up list, even when the old default date is today", () => {
    expect(kind({
      status: "OFFERTE_VERSTUURD",
      hasDocuments: true,
      sentAt: "2026-11-12T09:00:00.000Z",
      followUpDate: "2026-11-19",
    })).toBe("inProgress");
  });

  it("asks for follow-up when the follow-up date is today or earlier", () => {
    expect(kind({ status: "NIEUW", hasDocuments: false, followUpDate: "2026-11-19" })).toBe("followUp");
    expect(kind({ status: "NIEUW", hasDocuments: false, followUpDate: "2026-12-01" })).toBe("toMake");
  });

  it("leaves won and lost dossiers off every list", () => {
    expect(kind({ status: "GEWONNEN", hasDocuments: true, sentAt: "2026-11-01T00:00:00.000Z", followUpDate: "2026-11-01" })).toBeNull();
    expect(kind({ status: "VERLOREN", hasDocuments: false })).toBeNull();
  });
});
