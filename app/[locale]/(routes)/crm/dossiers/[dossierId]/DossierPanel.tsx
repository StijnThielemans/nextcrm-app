"use client";

import { useRef, useState } from "react";
import { ChevronRight, FileText, Folder, Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CHANNEL_LABELS,
  CHANNELS,
  DOSSIER_DOCUMENT_CATEGORIES,
  DOSSIER_DOCUMENT_LABELS,
  DOSSIER_STATUS_LABELS,
  OPEN_STATUSES,
  channelLabel,
  euro,
  statusLabel,
  type DossierDocumentCategory,
  type DossierStatus,
  type RequestChannel,
} from "@/lib/sales/labels";
import { ACCOUNT_ROLE_LABELS, PROJECT_GROUP_LABELS, type AccountRole, type ProjectGroup } from "@/lib/sales/aanvraag-fields";
import { groupDocumentsIntoFolders } from "@/lib/sales/document-folders";
import type { DossierDetail } from "@/lib/sales/service";
import {
  addChannelAction,
  attachDossierDocumentAction,
  attachOffertePdfAction,
  changeStatusAction,
  markSentAction,
  updateDossierAction,
} from "@/actions/crm/sales/actions";
import { uploadDocumentFile, uploadPdf } from "../../sales/upload-pdf";

const today = new Date().toISOString().slice(0, 10);

function asPdf(file: File): File | null {
  const looksPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksPdf || file.size === 0) return null;
  if (file.type === "application/pdf") return file;
  return new File([file], file.name, { type: "application/pdf" });
}

function followUpInDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function DocumentFolders({ documents }: { documents: DossierDetail["documents"] }) {
  const folders = groupDocumentsIntoFolders(documents);
  if (folders.length === 0) {
    return <p className="text-muted-foreground">Nog geen documenten.</p>;
  }

  return (
    <ul className="space-y-1">
      {folders.map((folder) => (
        <li key={folder.key}>
          <Collapsible className="group/folder">
            <CollapsibleTrigger
              data-folder={folder.label}
              className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left font-medium hover:bg-muted"
            >
              <ChevronRight className="size-4 shrink-0 transition-transform group-data-[state=open]/folder:rotate-90" aria-hidden />
              <Folder className="size-4 shrink-0 text-amber-700" aria-hidden />
              <span>{folder.label}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="ml-6 space-y-1 border-l py-1 pl-3">
                {folder.files.map((doc) => (
                  <li key={doc.id} className="flex items-start gap-2">
                    <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <a className="underline break-all" href={`/api/documents/${doc.id}/file`}>{doc.name}</a>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </li>
      ))}
    </ul>
  );
}

export function DossierPanel({ dossier }: { dossier: DossierDetail }) {
  const router = useRouter();
  const quoteInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<DossierStatus>((dossier.status as DossierStatus) || "NIEUW");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DossierDocumentCategory | "">("");
  const [dragging, setDragging] = useState(false);
  const [quoteDragging, setQuoteDragging] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const versions = dossier.families.flatMap((family) => family.quotes);

  async function run(work: () => Promise<{ error?: string; ok?: boolean; id?: string }>) {
    setBusy(true);
    setError(null);
    const result = await work();
    setBusy(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  function queueFile(file: File | undefined) {
    if (!file) return;
    setCategory("");
    setPendingFile(file);
  }

  async function storeQueued() {
    const file = pendingFile;
    if (!file || !category) return;
    const chosen = category;
    setPendingFile(null);
    await run(async () => {
      const uploaded = await uploadDocumentFile(file);
      if ("error" in uploaded) return uploaded;
      return attachDossierDocumentAction(dossier.id, { ...uploaded, category: chosen });
    });
  }

  async function storeOfferte(file: File | undefined) {
    if (!file) return;
    const pdf = asPdf(file);
    if (!pdf) {
      setError("Alleen een PDF is toegestaan.");
      return;
    }
    await run(async () => {
      const uploaded = await uploadPdf(pdf);
      if ("error" in uploaded) return uploaded;
      return attachOffertePdfAction(dossier.id, uploaded);
    });
  }

  function sendQuote(quoteId: string, documentId: string) {
    void run(() => markSentAction(dossier.id, {
      quoteId,
      documentId,
      followUpDate: followUpInDays(7),
    }));
  }

  const sentOn = new Map<string, string>();
  for (const send of dossier.sends) {
    if (!sentOn.has(send.quoteId)) sentOn.set(send.quoteId, send.sentAt.slice(0, 10));
  }
  const quoteRows = dossier.families.flatMap((family) => family.quotes.map((quote) => ({
    id: quote.id,
    pdfId: quote.pdfId,
    pdfName: quote.pdfName,
    date: quote.date,
    sentAt: sentOn.get(quote.id) ?? null,
    hasTotals: quote.cost !== 0 || quote.sell !== 0,
    totals: `${euro(quote.cost)} kost · ${euro(quote.sell)} verkoop · ${euro(quote.marginEuro)} marge`,
  })));
  const hasFollowUp = Boolean(dossier.followUpDate || dossier.nextStep || dossier.notes);

  return (
    <div className="space-y-8 max-w-5xl">
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border p-4 space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Klant en dossier</h2>
          <p><span className="text-muted-foreground">Klant </span><Link className="underline" href={`/crm/accounts/${dossier.customer.id}`}>{dossier.customer.name}</Link></p>
          <p><span className="text-muted-foreground">Contacttype </span>{dossier.customer.role && dossier.customer.role in ACCOUNT_ROLE_LABELS ? ACCOUNT_ROLE_LABELS[dossier.customer.role as AccountRole] : "—"}</p>
          <p><span className="text-muted-foreground">E-mail </span>{dossier.customer.email ?? "—"}</p>
          <p><span className="text-muted-foreground">Telefoon </span>{dossier.customer.phone ?? "—"}</p>
          <p><span className="text-muted-foreground">Gsm </span>{dossier.customer.mobile ?? "—"}</p>
          <p><span className="text-muted-foreground">BTW </span>{dossier.customer.vat ?? "—"}</p>
          <p><span className="text-muted-foreground">Adres </span>{dossier.customer.address || "—"}</p>
          <p><span className="text-muted-foreground">Project-Nr </span>{dossier.number ?? "—"}</p>
          <p><span className="text-muted-foreground">Projectbeschrijving </span>{dossier.name ?? "—"}</p>
          <p><span className="text-muted-foreground">Verkoper </span>{dossier.seller ?? "—"}</p>
          <p>
            <span className="text-muted-foreground">Architect </span>
            {dossier.architectName
              ? `${dossier.architectName}${dossier.architectExternalId ? ` (${dossier.architectExternalId})` : ""}`
              : "—"}
          </p>
          <p><span className="text-muted-foreground">Projectgroep </span>{dossier.projectGroup && dossier.projectGroup in PROJECT_GROUP_LABELS ? PROJECT_GROUP_LABELS[dossier.projectGroup as ProjectGroup] : "—"}</p>
          <p><span className="text-muted-foreground">Datum prijsaanvraag </span>{dossier.priceRequestDate ?? dossier.requestDate ?? "—"}</p>
          <p><span className="text-muted-foreground">Werfadres </span>{dossier.projectAddress || "—"}</p>
          <p><span className="text-muted-foreground">Status </span>{statusLabel(dossier.status)}</p>
          {dossier.lostReason && <p>Verliesreden: {dossier.lostReason}</p>}
        </div>

        <div
          className={`rounded-md border p-4 space-y-3 text-sm ${quoteDragging ? "bg-muted" : ""}`}
          onDragOver={(event) => {
            if (dossier.terminal) return;
            event.preventDefault();
            setQuoteDragging(true);
          }}
          onDragLeave={() => setQuoteDragging(false)}
          onDrop={(event) => {
            if (dossier.terminal) return;
            event.preventDefault();
            event.stopPropagation();
            setQuoteDragging(false);
            void storeOfferte(event.dataTransfer.files[0]);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Offertes</h2>
            {!dossier.terminal && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                aria-label="Offerte toevoegen"
                disabled={busy}
                onClick={() => quoteInput.current?.click()}
              >
                <Plus />
              </Button>
            )}
            <input
              ref={quoteInput}
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                void storeOfferte(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          {quoteRows.length === 0 && <p className="text-muted-foreground">Nog geen offertes.</p>}
          <ul className="space-y-3">
            {quoteRows.map((quote) => (
              <li key={quote.id} className="rounded-md border p-2 space-y-2">
                <a className="font-medium underline break-all" href={`/api/documents/${quote.pdfId}/file`}>{quote.pdfName}</a>
                <p><span className="text-muted-foreground">Datum </span>{quote.date}</p>
                {quote.hasTotals && <p><span className="text-muted-foreground">Totalen </span>{quote.totals}</p>}
                {quote.sentAt ? (
                  <p>Verstuurd {quote.sentAt}</p>
                ) : !dossier.terminal ? (
                  <Button type="button" size="sm" disabled={busy} onClick={() => sendQuote(quote.id, quote.pdfId)}>Versturen</Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border p-4 space-y-3 text-sm">
          <h2 className="text-lg font-semibold">Documentbeheer</h2>
          {!dossier.terminal && (
            <label
              className={`flex min-h-28 cursor-pointer items-center justify-center rounded-md border border-dashed px-3 text-center ${dragging ? "bg-muted" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                queueFile(event.dataTransfer.files[0]);
              }}
            >
              Sleep een document hierheen of kies een bestand
              <input
                className="sr-only"
                type="file"
                accept="application/pdf,image/*,.doc,.docx,.txt"
                onChange={(event) => {
                  queueFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          )}
          <Dialog open={pendingFile != null} onOpenChange={(open) => { if (!open) setPendingFile(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Categorie kiezen</DialogTitle>
                <DialogDescription>{pendingFile?.name}</DialogDescription>
              </DialogHeader>
              <label className="space-y-1 block text-sm">
                <span>Categorie</span>
                <select
                  className="flex h-9 w-full rounded-md border bg-transparent px-2"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as DossierDocumentCategory)}
                >
                  <option value="">Kies een categorie</option>
                  {DOSSIER_DOCUMENT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>{DOSSIER_DOCUMENT_LABELS[item]}</option>
                  ))}
                </select>
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPendingFile(null)}>Annuleren</Button>
                <Button type="button" disabled={!category || busy} onClick={() => void storeQueued()}>Opslaan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DocumentFolders documents={dossier.documents} />
        </div>

        <div className="rounded-md border p-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Opvolging</h2>
            {!dossier.terminal && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                aria-label="Opvolging toevoegen"
                disabled={busy}
                onClick={() => {
                  setStatus((dossier.status as DossierStatus) || "NIEUW");
                  setFollowOpen(true);
                }}
              >
                <Plus />
              </Button>
            )}
          </div>
          {hasFollowUp ? (
            <ul className="space-y-1">
              {dossier.followUpDate && <li><span className="text-muted-foreground">Datum </span>{dossier.followUpDate}</li>}
              {dossier.nextStep && <li><span className="text-muted-foreground">Volgende actie </span>{dossier.nextStep}</li>}
              {dossier.notes && <li><span className="text-muted-foreground">Notitie </span>{dossier.notes}</li>}
            </ul>
          ) : (
            <p className="text-muted-foreground">Nog geen opvolging.</p>
          )}
          {dossier.terminal && <p>Het verkooppad is gesloten. Er wordt geen order of factuur gemaakt.</p>}
          {dossier.terminal && dossier.status === "VERLOREN" && (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const reason = String(new FormData(event.currentTarget).get("lostReason") ?? "");
                void run(() => updateDossierAction(dossier.id, { lostReason: reason }));
              }}
            >
              <Input name="lostReason" defaultValue={dossier.lostReason ?? ""} />
              <Button type="submit" variant="secondary" disabled={busy}>Reden verbeteren</Button>
            </form>
          )}
          <Dialog open={followOpen} onOpenChange={setFollowOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Opvolging toevoegen</DialogTitle>
                <DialogDescription>Datum en notitie voor de volgende opvolging.</DialogDescription>
              </DialogHeader>
              <form
                key={`${dossier.followUpDate ?? ""}-${dossier.nextStep ?? ""}-${dossier.notes ?? ""}-${dossier.status ?? ""}`}
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void run(async () => {
                    const saved = await updateDossierAction(dossier.id, {
                      nextStep: String(data.get("nextStep") ?? ""),
                      followUpDate: String(data.get("followUp") ?? ""),
                      notes: String(data.get("notes") ?? ""),
                    });
                    if (saved.error) return saved;
                    setFollowOpen(false);
                    if (status === dossier.status) return { ok: true };
                    return changeStatusAction(dossier.id, {
                      status,
                      lostReason: String(data.get("lostReason") ?? ""),
                      acceptedQuoteId: String(data.get("accepted") ?? ""),
                    });
                  });
                }}
              >
                <label className="space-y-1">
                  <span className="text-sm">Datum</span>
                  <Input name="followUp" type="date" defaultValue={dossier.followUpDate ?? today} required />
                </label>
                <label className="space-y-1">
                  <span className="text-sm">Volgende actie</span>
                  <Input name="nextStep" defaultValue={dossier.nextStep ?? ""} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm">Status</span>
                  <select className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as DossierStatus)}>
                    {OPEN_STATUSES.filter((item) => item !== "OFFERTE_VERSTUURD").map((item) => (
                      <option key={item} value={item}>{DOSSIER_STATUS_LABELS[item]}</option>
                    ))}
                    {dossier.status === "OFFERTE_VERSTUURD" && <option value="OFFERTE_VERSTUURD">Offerte verstuurd</option>}
                    <option value="GEWONNEN">Gewonnen</option>
                    <option value="VERLOREN">Verloren</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm">Interne notitie</span>
                  <Input name="notes" defaultValue={dossier.notes ?? ""} />
                </label>
                {status === "VERLOREN" && (
                  <label className="space-y-1">
                    <span className="text-sm">Reden verloren</span>
                    <Input name="lostReason" required />
                  </label>
                )}
                {status === "GEWONNEN" && (
                  <label className="space-y-1">
                    <span className="text-sm">Aanvaarde versie</span>
                    <select name="accepted" className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm" required>
                      <option value="">Kies een versie</option>
                      {versions.map((quote) => <option key={quote.id} value={quote.id}>{quote.number} v{quote.version}</option>)}
                    </select>
                  </label>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setFollowOpen(false)}>Annuleren</Button>
                  <Button type="submit" disabled={busy}>Opslaan</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Contacten</h2>
        <ul className="text-sm space-y-1">
          {dossier.channels.map((event) => (
            <li key={event.id}>
              {event.at} · {channelLabel(event.channel)} · {event.seller}
              {event.original ? " · oorspronkelijk" : ""}
              {event.note ? ` · ${event.note}` : ""}
            </li>
          ))}
        </ul>
        {!dossier.terminal && (
          <form
            className="flex flex-wrap gap-2 items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void run(() => addChannelAction(dossier.id, {
                channel: String(form.get("channel")) as RequestChannel,
                date: String(form.get("date")),
                note: String(form.get("note") ?? ""),
              }));
            }}
          >
            <select name="channel" className="h-9 rounded-md border bg-transparent px-2 text-sm" defaultValue="PHONE">
              {CHANNELS.map((item) => <option key={item} value={item}>{CHANNEL_LABELS[item]}</option>)}
            </select>
            <Input name="date" type="date" defaultValue={today} required className="w-40" />
            <Input name="note" placeholder="Notitie" className="w-56" />
            <Button type="submit" variant="secondary" disabled={busy}>Contact toevoegen</Button>
          </form>
        )}
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
