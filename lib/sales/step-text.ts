/** Dutch labels produced by the dossier stepper, mapped to Sales.steps keys. */
const DUTCH_STEP_TO_ID: Record<string, string> = {
  Nieuw: "NIEUW",
  "In behandeling": "IN_BEHANDELING",
  "Offerte verstuurd": "OFFERTE_VERSTUURD",
  Opvolging: "OPVOLGING",
  Gewonnen: "GEWONNEN",
  Verloren: "VERLOREN",
  "Project maken": "PROJECT_MAKEN",
  "Gewonnen / Verloren": "AFSLUITING",
};

export function stepMessageKey(label: string): string | null {
  const id = DUTCH_STEP_TO_ID[label];
  return id ? `steps.${id}` : null;
}
