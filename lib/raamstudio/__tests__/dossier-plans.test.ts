import { plansOnDossier } from "../dossier-plans";

describe("plansOnDossier", () => {
  it("keeps Plannen, a calculatie PDF and a .tc-raam, and leaves quote PDFs out", () => {
    const plans = plansOnDossier([
      { id: "1", name: "PB681_Grondplannen.pdf", category: "PLANNEN" },
      { id: "2", name: "PB681_Gevels en snedes.pdf", category: "PLANNEN" },
      { id: "3", name: "oud-plan.pdf", category: "PLAN" },
      { id: "4", name: "calculatie.pdf", category: "CALCULATIE" },
      { id: "5", name: "kost.xlsx", category: "CALCULATIE" },
      { id: "6", name: "project.tc-raam", category: "CALCULATIE" },
      { id: "7", name: "offerte.pdf", category: "OFFERTE" },
      { id: "8", name: "los.tc-raam", category: "OFFERTE" },
    ]);

    expect(plans).toEqual([
      { id: "1", name: "PB681_Grondplannen.pdf", folder: "Plannen", kind: "plan" },
      { id: "2", name: "PB681_Gevels en snedes.pdf", folder: "Plannen", kind: "plan" },
      { id: "3", name: "oud-plan.pdf", folder: "Plannen", kind: "plan" },
      { id: "4", name: "calculatie.pdf", folder: "Calculatie", kind: "plan" },
      { id: "6", name: "project.tc-raam", folder: "Calculatie", kind: "tc-raam" },
      { id: "8", name: "los.tc-raam", folder: "Offerte", kind: "tc-raam" },
    ]);
    expect(JSON.stringify(plans)).not.toContain("positie");
    expect(plans.every((plan) => plan.kind === "plan" || plan.kind === "tc-raam")).toBe(true);
  });
});
