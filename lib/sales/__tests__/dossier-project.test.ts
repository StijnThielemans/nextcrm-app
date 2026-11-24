import { SalesError } from "../errors";
import { dossierIsReadOnly } from "../dossier-lock";
import { parseDossierProjectDraft, type DossierProjectInput } from "../dossier-project";

const open: DossierProjectInput = {
  projectName: "Prijsvraag buitenschrijnwerk - Matthias Verbruggen",
  sellerName: "Haegeman Robbe",
  projectGroup: "NIEUWBOUW",
  priceRequestDate: "2026-11-19",
  projectStreet: "Bloemstraat 24",
  projectPostalCode: "1840",
  projectCity: "Londerzeel",
  projectCountry: "BE",
};

describe("dossier project edit", () => {
  it("accepts a project group change and leaves the project number alone", () => {
    const patch = parseDossierProjectDraft({
      ...open,
      projectGroup: "RENOVATIE",
      dossierNumber: "OFF-2099-9999",
    } as DossierProjectInput);
    expect(patch.projectGroup).toBe("RENOVATIE");
    expect(patch.sellerName).toBe("Haegeman Robbe");
    expect(patch.name).toBe(open.projectName);
    expect(patch.priceRequestDate).toBe("2026-11-19");
    expect(patch.projectStreet).toBe("Bloemstraat 24");
    expect(patch.projectCountry).toBe("BE");
    expect(patch).not.toHaveProperty("dossier_number");
    expect(patch).not.toHaveProperty("dossierNumber");
    expect(patch).not.toHaveProperty("status");
    expect(Object.keys(patch)).toEqual([
      "name",
      "sellerName",
      "projectGroup",
      "priceRequestDate",
      "projectStreet",
      "projectPostalCode",
      "projectCity",
      "projectCountry",
      "architectName",
      "architectExternalId",
    ]);
  });

  it("clears an optional architect and an empty site address", () => {
    const patch = parseDossierProjectDraft({
      ...open,
      projectStreet: "  ",
      projectPostalCode: "",
      projectCity: "",
      projectCountry: "BE",
      architectName: "",
      architectExternalId: "",
    });
    expect(patch.architectName).toBeNull();
    expect(patch.architectExternalId).toBeNull();
    expect(patch.projectStreet).toBeNull();
    expect(patch.projectCountry).toBeNull();
  });

  it("rejects a half-chosen architect and a missing project description", () => {
    expect(() => parseDossierProjectDraft({ ...open, architectName: "Janssens" })).toThrow(SalesError);
    expect(() => parseDossierProjectDraft({ ...open, projectName: "  " })).toThrow(SalesError);
    expect(() => parseDossierProjectDraft({ ...open, sellerName: "Iemand Anders" })).toThrow(SalesError);
    expect(() => parseDossierProjectDraft({ ...open, projectGroup: "ANDERS" })).toThrow(SalesError);
    expect(() => parseDossierProjectDraft({ ...open, priceRequestDate: "19-11-2026" })).toThrow(SalesError);
  });

  it("keeps a lost dossier locked and leaves the open steps editable", () => {
    expect(dossierIsReadOnly("VERLOREN")).toBe(true);
    for (const status of ["NIEUW", "IN_BEHANDELING", "OFFERTE_VERSTUURD", "OPVOLGING", "GEWONNEN", null]) {
      expect(dossierIsReadOnly(status)).toBe(false);
    }
  });
});
