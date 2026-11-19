/**
 * Server adapter for the official Logikal REST API.
 *
 * Checked on 19 Nov 2026: this repo, the env examples, and the local disk have
 * no swagger, OpenAPI file, base URL, or credentials for this installation.
 * Orgadata's public help documents the SQLite ERP export, not a project-create
 * endpoint. This function therefore does not open a connection and does not
 * guess a path, an auth scheme, or a field mapping.
 *
 * Dossier number and name are accepted so a later call can map them onto
 * fields the swagger of this installation actually lists.
 */
export type LogikalCreateInput = {
  dossierNumber: string | null;
  dossierName: string | null;
};

export type LogikalGatewayResult =
  | { outcome: "created"; projectId: string; projectName: string | null }
  | { outcome: "found"; projectId: string; projectName: string | null }
  | { outcome: "not_configured" }
  | { outcome: "unknown" }
  | { outcome: "failed" };

export async function logikalGateway(_input: LogikalCreateInput): Promise<LogikalGatewayResult> {
  return { outcome: "not_configured" };
}
