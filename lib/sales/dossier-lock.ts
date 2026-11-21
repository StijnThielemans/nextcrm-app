/** Verloren freezes the dossier. Gewonnen stays editable: quotes, documents, and follow-up. */
export function dossierIsReadOnly(status: string | null | undefined): boolean {
  return status === "VERLOREN";
}
