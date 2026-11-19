import {
  distributedMailsToMake,
  mergeDistributedIntoToMake,
  type DistributedMail,
} from "../distributed-requests";

function mail(partial: Partial<DistributedMail> & Pick<DistributedMail, "id">): DistributedMail {
  return {
    sellerName: "Ideler Yannick",
    fromName: "Jan Janssen",
    fromEmail: "jan@example.com",
    subject: "Schuiframen living",
    dossier: null,
    dossierHidden: false,
    ...partial,
  };
}

describe("distributed offertebox mails on the dashboard", () => {
  const listed = new Set(["dossier-open"]);

  it("shows a distributed mail that has no dossier yet, with sender and subject", () => {
    const [task] = distributedMailsToMake(listed, [mail({ id: "mail-1" })]);
    expect(task).toMatchObject({
      id: "offertebox:mail-1",
      href: "/crm/aanvraag?offertebox=mail-1",
      request: { sender: "Jan Janssen", subject: "Schuiframen living" },
    });
    expect(task.label).toContain("Jan Janssen");
    expect(task.label).toContain("Schuiframen living");
  });

  it("uses the e-mail when the sender left no name", () => {
    const [task] = distributedMailsToMake(listed, [mail({ id: "mail-2", fromName: "  " })]);
    expect(task.request).toEqual({ sender: "jan@example.com", subject: "Schuiframen living" });
  });

  it("keeps a row when the mail has no sender name, instead of a blank line", () => {
    const [task] = distributedMailsToMake(listed, [mail({ id: "mail-3", fromName: "", fromEmail: "", subject: "" })]);
    expect(task.label.trim().length).toBeGreaterThan(0);
    expect(task.request?.sender.trim().length).toBeGreaterThan(0);
    expect(task.request?.subject.trim().length).toBeGreaterThan(0);
  });

  it("leaves a mail that is still to assign off the list", () => {
    expect(distributedMailsToMake(listed, [mail({ id: "mail-4", sellerName: null })])).toEqual([]);
    expect(distributedMailsToMake(listed, [mail({ id: "mail-5", sellerName: "   " })])).toEqual([]);
  });

  it("shows a linked dossier once when that dossier is already on the list", () => {
    const tasks = distributedMailsToMake(listed, [
      mail({
        id: "mail-6",
        dossier: { id: "dossier-open", label: "OFF-2026-0004 Jan Peeters", quoteSent: false },
      }),
    ]);
    expect(tasks).toEqual([]);
  });

  it("shows one dossier row when several mails point at a won or lost dossier without a send", () => {
    const linked = { id: "dossier-lost", label: "OFF-2026-0002 Peeters", quoteSent: false };
    const tasks = distributedMailsToMake(listed, [
      mail({ id: "mail-7", dossier: linked }),
      mail({ id: "mail-8", dossier: linked }),
    ]);
    expect(tasks).toEqual([
      {
        id: "dossier-lost",
        label: "OFF-2026-0002 Peeters",
        href: "/crm/dossiers/dossier-lost",
        request: null,
      },
    ]);
  });

  it("drops the mail once a quote was sent on the linked dossier", () => {
    const tasks = distributedMailsToMake(new Set(), [
      mail({
        id: "mail-9",
        dossier: { id: "dossier-sent", label: "OFF-2026-0003", quoteSent: true },
      }),
    ]);
    expect(tasks).toEqual([]);
  });

  it("does not turn a hidden dossier into a new request row", () => {
    expect(distributedMailsToMake(listed, [mail({ id: "mail-10", dossierHidden: true })])).toEqual([]);
  });

  it("puts new requests in front and keeps existing to-make rows, without touching the other columns", () => {
    const existing = [
      { id: "dossier-open", label: "OFF-2026-0004 Jan Peeters", href: "/crm/dossiers/dossier-open", request: null },
    ];
    const inProgress = [{ id: "busy", label: "OFF-2026-0001", href: "/crm/dossiers/busy", request: null }];
    const followUp = [{ id: "later", label: "OFF-2026-0005", href: "/crm/dossiers/later", request: null }];
    const additions = distributedMailsToMake(new Set(["dossier-open", "busy", "later"]), [
      mail({ id: "new-mail" }),
      mail({
        id: "lost-mail",
        dossier: { id: "dossier-lost", label: "OFF-2026-0002 Peeters", quoteSent: false },
      }),
    ]);
    const toMake = mergeDistributedIntoToMake(existing, additions);
    expect(toMake.map((task) => task.id)).toEqual(["offertebox:new-mail", "dossier-open", "dossier-lost"]);
    expect(inProgress.map((task) => task.id)).toEqual(["busy"]);
    expect(followUp.map((task) => task.id)).toEqual(["later"]);
  });
});
