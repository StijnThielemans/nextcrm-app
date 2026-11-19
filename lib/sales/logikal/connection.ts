/**
 * Settings the official Logikal client actually reads.
 *
 * Ofcas.Lk.Api.Client.Core 3.0.2.11-experimental (public-nuget.orgadata.com)
 * is a Windows WCF client, not an HTTP API. CreateTCPServiceFactory uses
 * net.tcp://{host}:{port}. The service is started with -tcpPort. The named
 * pipe net.pipe://localhost/ofcas/lk/api/service/ only exists on the same
 * Windows machine as Logikal.
 *
 * Login (WellKnownParameterKey.Login) uses the dictionary keys USER_NAME,
 * PASSWORD and the required PROGRAM_MODE. The package does not list allowed
 * PROGRAM_MODE values. A new project name is PROJECTCENTER_CREATE_CHILD_NAME.
 *
 * Values stay on the server. Callers only receive the names that are empty.
 */

export const LOGIKAL_SERVER_SETTINGS = [
  "LOGIKAL_TCP_HOST",
  "LOGIKAL_TCP_PORT",
  "LOGIKAL_USERNAME",
  "LOGIKAL_PASSWORD",
  "LOGIKAL_PROGRAM_MODE",
] as const;

export type LogikalServerSetting = (typeof LOGIKAL_SERVER_SETTINGS)[number];

export function logikalMissingSettings(
  env: NodeJS.ProcessEnv = process.env,
): LogikalServerSetting[] {
  return LOGIKAL_SERVER_SETTINGS.filter((name) => !env[name]?.trim());
}

/**
 * True only when this process can perform the documented Ofcas login and
 * ProjectCenter.CreateChild call. That call is a Windows net.tcp service,
 * and this server has no such client, so this stays false.
 */
export function logikalCanCreateProject(): boolean {
  return false;
}
