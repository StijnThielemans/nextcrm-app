import type { DossierPlanFile } from "./dossier-plans";

/** What Calculatie controleren may do next. Nothing here writes a file. */
export type Raamstudio2Next = "resume" | "prepare" | "closed";

export type Raamstudio2Gate = {
  /** PDFs already stored in the Plannen folder. */
  planFiles: DossierPlanFile[];
  /** PDFs already stored in the Calculatie folder. */
  calculatieFiles: DossierPlanFile[];
  /** The saved .tc-raam, preferring the RaamStudio work file of this dossier. */
  workFile: DossierPlanFile | null;
  next: Raamstudio2Next;
};

/**
 * Read-only check on documents that are already on the dossier.
 * A work file means continue. No work file on an open dossier means prepare a new project in the existing RaamStudio.
 * A closed dossier without a work file stays closed. Plan PDFs are never a work file.
 */
export function raamstudio2Gate(input: { locked: boolean; plans: DossierPlanFile[] }): Raamstudio2Gate {
  const planFiles = input.plans.filter((plan) => plan.kind === "plan" && plan.folder === "Plannen");
  const calculatieFiles = input.plans.filter((plan) => plan.kind === "plan" && plan.folder === "Calculatie");
  const workFiles = input.plans.filter((plan) => plan.kind === "tc-raam");
  const workFile = workFiles.find((plan) => plan.name.startsWith("RaamStudio ")) ?? workFiles[0] ?? null;
  const next: Raamstudio2Next = workFile ? "resume" : input.locked ? "closed" : "prepare";
  return { planFiles, calculatieFiles, workFile, next };
}
