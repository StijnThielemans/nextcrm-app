import { raamstudioDossierMatches } from "../dossier-list-search";

const dossiers = [
  { number: "OFF-2026-0014", name: "Prijsvraag buitenschrijnwerk - Matthias Verbruggen", customer: "Verbruggen Matthias" },
  { number: "OFF-2026-0015", name: "Van Houtven NV-Boutens", customer: "Van Houtven NV" },
  { number: "OFF-2026-0010", name: "De Bondt Ludie-nieuw", customer: "De Bondt Ludie" },
];

describe("RaamStudio dossier search", () => {
  it("shows the whole list when the field is empty", () => {
    expect(dossiers.filter((dossier) => raamstudioDossierMatches(dossier, "  "))).toHaveLength(3);
  });

  it("filters on project number, description and customer as you type", () => {
    expect(dossiers.filter((dossier) => raamstudioDossierMatches(dossier, "0014")).map((dossier) => dossier.number)).toEqual(["OFF-2026-0014"]);
    expect(dossiers.filter((dossier) => raamstudioDossierMatches(dossier, "boutens")).map((dossier) => dossier.number)).toEqual(["OFF-2026-0015"]);
    expect(dossiers.filter((dossier) => raamstudioDossierMatches(dossier, "verbruggen")).map((dossier) => dossier.number)).toEqual(["OFF-2026-0014"]);
    expect(dossiers.filter((dossier) => raamstudioDossierMatches(dossier, "geen-dossier"))).toHaveLength(0);
  });

  it("also matches seller, site, project number and status when those fields are present", () => {
    const row = {
      number: "OFF-2026-0014",
      name: "Prijsvraag",
      customer: "Verbruggen Matthias",
      projectNumber: "1000000326",
      site: "Kerkstraat 1, 9000 Gent",
      seller: "Stijn",
      status: "Verloren",
    };
    expect(raamstudioDossierMatches(row, "1000000326")).toBe(true);
    expect(raamstudioDossierMatches(row, "kerkstraat")).toBe(true);
    expect(raamstudioDossierMatches(row, "stijn")).toBe(true);
    expect(raamstudioDossierMatches(row, "verloren")).toBe(true);
  });
});
