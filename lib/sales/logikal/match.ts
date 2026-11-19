function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("en");
}

/**
 * OrderNo and a Projects.ID / ProjectID are the references Orgadata documents.
 * A name match alone is not enough to call the file the same Logikal project.
 * When those references are missing, or they only resemble this dossier, the
 * caller must ask before importing.
 */
export function matchLogikalExport(input: {
  linkedProjectId: string | null;
  dossierNumber: string | null;
  dossierName: string | null;
  exportName: string | null;
  exportOrderNo: string | null;
  exportProjectKey: string | null;
}): "match" | "mismatch" | "uncertain" {
  const linked = norm(input.linkedProjectId);
  const orderNo = norm(input.exportOrderNo);
  const projectKey = norm(input.exportProjectKey);
  const name = norm(input.exportName);
  const dossierNumber = norm(input.dossierNumber);
  const dossierName = norm(input.dossierName);
  const reliable = [orderNo, projectKey].filter(Boolean);
  if (!linked) return "uncertain";
  if (reliable.includes(linked) || (name !== "" && name === linked)) return "match";
  const recognizable =
    (orderNo !== "" && dossierNumber !== "" && orderNo === dossierNumber)
    || (name !== "" && dossierName !== "" && name === dossierName);
  if (reliable.length > 0 && !recognizable) return "mismatch";
  return "uncertain";
}
