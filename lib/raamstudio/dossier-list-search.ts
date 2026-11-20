export type RaamstudioListDossier = {
  number: string | null;
  name: string | null;
  customer: string | null;
};

/** Live filter for the RaamStudio dossier list: project number, description and customer. */
export function raamstudioDossierMatches(dossier: RaamstudioListDossier, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase("nl");
  if (!needle) return true;
  const haystack = [dossier.number, dossier.name, dossier.customer]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .toLocaleLowerCase("nl");
  return haystack.includes(needle);
}
