import { offerteGross } from "@/lib/sales/offerte-list";
import { offerteMatchesSearch, offertePriceLabel, type OfferteSearchRow } from "../offerte-search";

const amber: OfferteSearchRow = {
  id: "quote-amber",
  pdfId: "pdf-amber",
  name: "Offerte OFF-01760-26 De Brabanter Amber-reno.pdf",
  number: "Offerte OFF-01760-26 De Brabanter Amber-reno",
  gross: 6220.65,
  date: "2026-11-19",
  sentAt: "2026-11-19",
  dossierId: "dossier-11",
  dossierNumber: "OFF-2026-0011",
  dossierName: "Peirlinkc Nicolas",
  customer: "Peirlinkc Nicolas",
  seller: "Haegeman Robbe",
  status: "GEWONNEN",
  won: true,
};

const draft: OfferteSearchRow = {
  ...amber,
  id: "quote-draft",
  name: "proef-offerte.pdf",
  number: "proef-offerte",
  gross: null,
  sentAt: null,
  status: "OFFERTE_VERSTUURD",
  won: false,
};

describe("offertes list", () => {
  it("matches every visible field of a won quote", () => {
    expect(offerteMatchesSearch(amber, "Amber-reno")).toBe(true);
    expect(offerteMatchesSearch(amber, "6220,65")).toBe(true);
    expect(offerteMatchesSearch(amber, "6.220,65")).toBe(true);
    expect(offerteMatchesSearch(amber, "OFF-2026-0011")).toBe(true);
    expect(offerteMatchesSearch(amber, "Haegeman")).toBe(true);
    expect(offerteMatchesSearch(amber, "Gewonnen")).toBe(true);
    expect(offerteMatchesSearch(amber, "2026-11-19")).toBe(true);
  });

  it("matches a quote without a price and ignores other rows", () => {
    expect(offertePriceLabel(null)).toBe("geen prijs");
    expect(offerteMatchesSearch(draft, "geen prijs")).toBe(true);
    expect(offerteMatchesSearch(draft, "Gewonnen")).toBe(false);
    expect(offerteMatchesSearch(amber, "proef-offerte")).toBe(false);
  });

  it("keeps a stored totaal bruto ahead of a zero verkoopprijs", () => {
    expect(offerteGross(6220.65, 0)).toBe(6220.65);
    expect(offerteGross(null, 1000)).toBe(1000);
    expect(offerteGross(null, 0)).toBeNull();
  });
});
