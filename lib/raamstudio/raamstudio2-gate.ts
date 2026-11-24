import type { DossierPlanFile } from "./dossier-plans";

/** What Calculatie controleren may do next. Nothing here writes a file. */
export type Raamstudio2Next = "resume" | "prepare" | "closed";

export type Studio2File = { id: string; name: string };

export type Raamstudio2Gate = {
  /** PDFs already stored in the Plannen folder. */
  planFiles: DossierPlanFile[];
  /** PDFs already stored in the Calculatie folder. */
  calculatieFiles: DossierPlanFile[];
  /** The .rs2 project. A .tc-raam from the older studio is not this file. */
  workFile: Studio2File | null;
  next: Raamstudio2Next;
};

/**
 * Read-only check on documents that are already on the dossier.
 * A .rs2 means continue in Raamstudio 2. No .rs2 on an open dossier means prepare a new .rs2.
 * A closed dossier without a .rs2 stays closed. Plan PDFs are never the project file.
 */
export function raamstudio2Gate(input: { locked: boolean; plans: DossierPlanFile[]; studio2: Studio2File | null }): Raamstudio2Gate {
  const planFiles = input.plans.filter((plan) => plan.kind === "plan" && plan.folder === "Plannen");
  const calculatieFiles = input.plans.filter((plan) => plan.kind === "plan" && plan.folder === "Calculatie");
  const workFile = input.studio2;
  const next: Raamstudio2Next = workFile ? "resume" : input.locked ? "closed" : "prepare";
  return { planFiles, calculatieFiles, workFile, next };
}
