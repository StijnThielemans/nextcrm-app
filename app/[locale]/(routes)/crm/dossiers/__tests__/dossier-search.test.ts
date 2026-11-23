import { dossierMatchesSearch, type DossierSearchRow } from "../dossier-search";

const nicolas: DossierSearchRow = {
  id: "dossier-11",
  number: "OFF-2026-0011",
  executionProjectNumber: "1000000126",
  name: "Peirlinkc Nicolas",
  status: "OFFERTE_VERSTUURD",
  stepLabel: "Offerte verstuurd",
  customer: "Peirlinkc Nicolas",
  contactType: "CUSTOMER",
  email: "nicolas@thielemans.be",
  phone: null,
  mobile: "0478963526",
  vat: null,
  street: "Beugemstraat 10",
  postalCode: "9310",
  city: "Aalst",
  seller: "Haegeman Robbe",
  architectName: "Walravens Weets Architecten",
  architectExternalId: "B910543",
  projectGroup: "RENOVATIE",
  requestDate: "2026-11-19",
  priceRequestDate: "2026-11-19",
  followUpDate: "2026-11-26",
  projectStreet: "Beugemstraat 10",
  projectPostalCode: "9310",
  projectCity: "Aalst",
  projectCountry: "BE",
};

describe("offertedossier list search", () => {
  it("matches a fragment of every dossier field for Peirlinkc Nicolas", () => {
    expect(dossierMatchesSearch(nicolas, "nicolas@thielemans.be")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "0478963526")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "Beugemstraat")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "Walravens")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "Renovatie")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "Haegeman")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "Offerte verstuurd")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "OFF-2026-0011")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "1000000126")).toBe(true);
    expect(dossierMatchesSearch({ ...nicolas, executionProjectNumber: null }, "1000000126")).toBe(false);
  });

  it("matches contact type, vat, address parts, architect id, and the follow-up date", () => {
    expect(dossierMatchesSearch(nicolas, "Klant")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "9310")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "Aalst")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "B910543")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "2026-11-26")).toBe(true);
    expect(dossierMatchesSearch({ ...nicolas, vat: "BE0123456789" }, "BE0123")).toBe(true);
    expect(dossierMatchesSearch({ ...nicolas, phone: "053 12 34 56" }, "053123456")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "0478 963 526")).toBe(true);
  });

  it("keeps every row when the box is empty", () => {
    expect(dossierMatchesSearch(nicolas, "")).toBe(true);
    expect(dossierMatchesSearch(nicolas, "   ")).toBe(true);
  });

  it("hides a row that matches none of the fields", () => {
    expect(dossierMatchesSearch(nicolas, "Antwerpen")).toBe(false);
    expect(dossierMatchesSearch(nicolas, "jan.peeters@example.com")).toBe(false);
    expect(dossierMatchesSearch({ ...nicolas, name: "Andere", customer: "Andere", contactType: "SUPPLIER" }, "Klant")).toBe(false);
  });
});
