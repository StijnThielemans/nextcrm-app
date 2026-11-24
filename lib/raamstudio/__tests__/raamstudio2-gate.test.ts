import { raamstudio2Gate } from "../raamstudio2-gate";
import type { DossierPlanFile } from "../dossier-plans";

const plan: DossierPlanFile = { id: "p", name: "PB681_Grondplannen.pdf", folder: "Plannen", kind: "plan" };
const calc: DossierPlanFile = { id: "c", name: "calculatie.pdf", folder: "Calculatie", kind: "plan" };
const named: DossierPlanFile = { id: "w", name: "RaamStudio OFF-2026-0001.tc-raam", folder: "Calculatie", kind: "tc-raam" };
const loose: DossierPlanFile = { id: "o", name: "los.tc-raam", folder: "Offerte", kind: "tc-raam" };

describe("raamstudio2Gate", () => {
  it("continues the RaamStudio work file and keeps plan PDFs as plans", () => {
    const gate = raamstudio2Gate({ locked: false, plans: [plan, calc, loose, named] });
    expect(gate.workFile?.id).toBe("w");
    expect(gate.planFiles.map((file) => file.id)).toEqual(["p"]);
    expect(gate.calculatieFiles.map((file) => file.id)).toEqual(["c"]);
    expect(gate.next).toBe("resume");
  });

  it("prepares a new project when the dossier is open and has no work file", () => {
    expect(raamstudio2Gate({ locked: false, plans: [plan, calc] }).next).toBe("prepare");
  });

  it("does not prepare a new project on a closed dossier without a work file", () => {
    expect(raamstudio2Gate({ locked: true, plans: [plan] }).next).toBe("closed");
  });

  it("still opens a closed dossier that already has a work file", () => {
    expect(raamstudio2Gate({ locked: true, plans: [named] }).next).toBe("resume");
  });

  it("uses another .tc-raam when the named RaamStudio file is absent", () => {
    expect(raamstudio2Gate({ locked: false, plans: [loose] }).workFile?.id).toBe("o");
  });
});
