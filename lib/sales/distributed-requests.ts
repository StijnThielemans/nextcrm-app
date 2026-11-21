/** A mail that left Offertebox "Te verdelen". The quote is still open until a send exists. */
export type DistributedMail = {
  id: string;
  /** Blank means the mail is still unassigned. A linked dossier's seller wins, same as the Offertebox. */
  sellerName: string | null;
  fromName: string;
  fromEmail: string;
  subject: string;
  /**
   * Linked dossier this user may open. Null when the mail has no dossier.
   * When the dossier exists but is deleted or outside this user's scope, set dossierHidden instead.
   */
  dossier: { id: string; label: string; quoteSent: boolean } | null;
  dossierHidden: boolean;
};

export type DashboardTask = {
  id: string;
  label: string;
  href: string;
  /** Set for a distributed mail that has no dossier yet. The label stays filled in either case. */
  request: { sender: string; subject: string } | null;
};

/**
 * Distributed Offertebox mails that still belong on "Nieuwe offertes te maken".
 * A dossier already on the dashboard is not repeated. A sent quote drops the mail.
 * Won or lost without a send stays, because the Offertebox uses the same rule.
 * The result is only for that one column.
 */
export function distributedMailsToMake(
  listedDossierIds: ReadonlySet<string>,
  mails: readonly DistributedMail[],
): DashboardTask[] {
  const seen = new Set(listedDossierIds);
  const tasks: DashboardTask[] = [];
  for (const mail of mails) {
    if (!mail.sellerName?.trim()) continue;
    if (mail.dossierHidden) continue;
    if (mail.dossier?.quoteSent) continue;
    if (mail.dossier) {
      if (seen.has(mail.dossier.id)) continue;
      seen.add(mail.dossier.id);
      tasks.push({
        id: mail.dossier.id,
        label: mail.dossier.label.trim() || "Offertedossier",
        href: `/crm/dossiers/${mail.dossier.id}`,
        request: null,
      });
      continue;
    }
    const request = requestText(mail);
    tasks.push({
      id: `offertebox:${mail.id}`,
      label: request.subject ? `${request.sender} — ${request.subject}` : request.sender,
      href: `/crm/aanvraag?offertebox=${mail.id}`,
      request,
    });
  }
  return tasks;
}

/** New mails sit in front of the dossiers already to make. Won or lost dossiers stay at the end. */
export function mergeDistributedIntoToMake<T extends { request: unknown }>(existing: readonly T[], additions: readonly T[]): T[] {
  const requests = additions.filter((task) => task.request);
  const stayed = additions.filter((task) => !task.request);
  return [...requests, ...existing, ...stayed];
}

function requestText(mail: DistributedMail): { sender: string; subject: string } {
  const sender = mail.fromName.trim() || mail.fromEmail.trim() || "—";
  const subject = mail.subject.trim() || "Aanvraag";
  return { sender, subject };
}
