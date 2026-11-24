import { raamstudio2Gate } from "../raamstudio2-gate";
import type { DossierPlanFile } from "../dossier-plans";

const plan: DossierPlanFile = { id: "p", name: "PB681_Grondplannen.pdf", folder: "Plannen", kind: "plan" };
const calc: DossierPlanFile = { id: "c", name: "calculatie.pdf", folder: "Calculatie", kind: "plan" };
const oldFile: DossierPlanFile = { id: "w", name: "RaamStudio OFF-2026-0001.tc-raam", folder: "Calculatie", kind: "tc-raam" };
const studio2 = { id: "r", name: "Raamstudio2 OFF-2026-0001.rs2" };

describe("raamstudio2Gate", () => {
  it("continues a .rs2 and leaves plan PDFs as plans", () => {
    const gate = raamstudio2Gate({ locked: false, plans: [plan, calc, oldFile], studio2 });
    expect(gate.workFile?.id).toBe("r");
    expect(gate.planFiles.map((file) => file.id)).toEqual(["p"]);
    expect(gate.calculatieFiles.map((file) => file.id)).toEqual(["c"]);
    expect(gate.next).toBe("resume");
  });

  it("does not treat a .tc-raam as the Raamstudio 2 project", () => {
    expect(raamstudio2Gate({ locked: false, plans: [oldFile, plan], studio2: null }).next).toBe("prepare");
  });

  it("prepares a new .rs2 when the dossier is open and has no project file", () => {
    expect(raamstudio2Gate({ locked: false, plans: [plan, calc], studio2: null }).next).toBe("prepare");
  });

  it("does not prepare a new project on a closed dossier without a .rs2", () => {
    expect(raamstudio2Gate({ locked: true, plans: [plan], studio2: null }).next).toBe("closed");
  });

  it("still opens a closed dossier that already has a .rs2", () => {
    expect(raamstudio2Gate({ locked: true, plans: [], studio2 }).next).toBe("resume");
  });
});
