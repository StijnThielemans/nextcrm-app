/**
 * Server adapter for the official Logikal client.
 *
 * Ofcas.Lk.Api.Client.Core 3.0.2.11-experimental documents login and project
 * creation, but only as a Windows WCF service:
 *   net.tcp://{host}:{port}   (the service is started with -tcpPort)
 *   net.pipe://localhost/ofcas/lk/api/service/
 * Login keys are USER_NAME, PASSWORD and the required PROGRAM_MODE.
 * The package does not list allowed PROGRAM_MODE values.
 * A project name is sent as PROJECTCENTER_CREATE_CHILD_NAME.
 *
 * There is no documented HTTP path. This function therefore does not open a
 * socket and does not report a created project. Dossier number and name stay
 * on the input so a later call can map the name onto that documented field.
 * The offer number is not a CreateChild field in this package.
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
