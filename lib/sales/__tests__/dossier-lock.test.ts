import { dossierIsReadOnly } from "../dossier-lock";

describe("dossier read-only lock", () => {
  it("freezes only a lost dossier", () => {
    expect(dossierIsReadOnly("VERLOREN")).toBe(true);
  });

  it("leaves a won dossier editable", () => {
    expect(dossierIsReadOnly("GEWONNEN")).toBe(false);
    expect(dossierIsReadOnly("NIEUW")).toBe(false);
    expect(dossierIsReadOnly("OFFERTE_VERSTUURD")).toBe(false);
    expect(dossierIsReadOnly(null)).toBe(false);
  });
});
