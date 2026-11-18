"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CHANNEL_LABELS,
  CHANNELS,
  DOSSIER_STATUS_LABELS,
  OPEN_STATUSES,
  channelLabel,
  euro,
  percentLabel,
  statusLabel,
  type DossierStatus,
  type RequestChannel,
} from "@/lib/sales/labels";
import type { DossierDetail } from "@/lib/sales/service";
import {
  addChannelAction,
  changeStatusAction,
  markReadyAction,
  markSentAction,
  registerQuoteAction,
  updateDossierAction,
  uploadCustomerQuoteAction,
} from "@/actions/crm/sales/actions";
import { uploadPdf } from "../../sales/upload-pdf";

const today = new Date().toISOString().slice(0, 10);

export function DossierPanel({ dossier }: { dossier: DossierDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [familyId, setFamilyId] = useState("");
  const [status, setStatus] = useState<DossierStatus>((dossier.status as DossierStatus) || "NIEUW");
  const versions = dossier.families.flatMap((family) => family.quotes);

  async function run(work: () => Promise<{ error?: string; ok?: boolean; id?: string }>) {
    setBusy(true);
    setError(null);
    const result = await work();
    setBusy(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <section className="grid gap-2 text-sm sm:grid-cols-2">
        <p><span className="text-muted-foreground">Nummer </span>{dossier.number}</p>
        <p><span className="text-muted-foreground">Status </span>{statusLabel(dossier.status)}</p>
        <p><span className="text-muted-foreground">Klant </span><Link className="underline" href={`/crm/accounts/${dossier.customer.id}`}>{dossier.customer.name}</Link></p>
        <p><span className="text-muted-foreground">Verkoper </span>{dossier.seller ?? "—"}</p>
        <p><span className="text-muted-foreground">Kanaal </span>{channelLabel(dossier.channel)}</p>
        <p><span className="text-muted-foreground">Aanvraag </span>{dossier.requestDate ?? "—"}</p>
        <p className="sm:col-span-2"><span className="text-muted-foreground">Werf </span>{dossier.projectAddress || "—"}</p>
        {dossier.description && <p className="sm:col-span-2">{dossier.description}</p>}
        {dossier.lostReason && <p className="sm:col-span-2">Verliesreden: {dossier.lostReason}</p>}
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Externe offerte</h2>
        <p className="text-sm text-muted-foreground">De ramen en deuren worden in de configurator van de leverancier gemaakt. Hier registreer je de PDF en de prijzen. Een nieuwe versie overschrijft de vorige niet.</p>
        {dossier.families.map((family) => (
          <div key={family.id} className="rounded-md border p-3 text-sm space-y-2">
            <p className="font-medium">{family.supplier} · {family.configurator} · {family.reference}</p>
            <ul className="space-y-1">
              {family.quotes.map((quote) => (
                <li key={quote.id}>
                  v{quote.version} {quote.number} ({quote.date}) · kost {euro(quote.cost)} · verkoop {euro(quote.sell)} · marge {euro(quote.marginEuro)} ({percentLabel(quote.marginPercent)}) · {quote.status === "ACTIVE" ? "actief" : "vorige versie"}
                  {" · "}
                  <a className="underline" href={`/api/documents/${quote.pdfId}/file`}>{quote.pdfName}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!dossier.terminal && (
          <form
            className="grid gap-3 sm:grid-cols-2 rounded-md border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              const file = data.get("pdf");
              if (!(file instanceof File) || file.size === 0) {
                setError("Kies de PDF van de leverancier.");
                return;
              }
              void run(async () => {
                const uploaded = await uploadPdf(file);
                if ("error" in uploaded) return uploaded;
                return registerQuoteAction(dossier.id, {
                  familyId: familyId || undefined,
                  supplier: String(data.get("supplier") ?? ""),
                  configurator: String(data.get("configurator") ?? ""),
                  supplierReference: String(data.get("reference") ?? ""),
                  quoteNumber: String(data.get("quoteNumber") ?? ""),
                  quoteDate: String(data.get("quoteDate") ?? ""),
                  cost: String(data.get("cost") ?? ""),
                  sell: String(data.get("sell") ?? ""),
                  vatRate: String(data.get("vat") ?? "21"),
                  notes: String(data.get("notes") ?? ""),
                  file: uploaded,
                });
              });
            }}
          >
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm">Soort</span>
              <select className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={familyId} onChange={(event) => setFamilyId(event.target.value)}>
                <option value="">Alternatief (nieuwe offerte)</option>
                {dossier.families.map((family) => (
                  <option key={family.id} value={family.id}>Nieuwe versie van {family.supplier} {family.reference}</option>
                ))}
              </select>
            </label>
            {!familyId && (
              <>
                <label className="space-y-1"><span className="text-sm">Leverancier</span><Input name="supplier" required /></label>
                <label className="space-y-1"><span className="text-sm">Configurator</span><Input name="configurator" required /></label>
                <label className="space-y-1 sm:col-span-2"><span className="text-sm">Leveranciersreferentie</span><Input name="reference" required /></label>
              </>
            )}
            <label className="space-y-1"><span className="text-sm">Offertenummer</span><Input name="quoteNumber" required /></label>
            <label className="space-y-1"><span className="text-sm">Datum</span><Input name="quoteDate" type="date" defaultValue={today} required /></label>
            <label className="space-y-1"><span className="text-sm">Kost excl. btw</span><Input name="cost" inputMode="decimal" required defaultValue="0" /></label>
            <label className="space-y-1"><span className="text-sm">Verkoop excl. btw</span><Input name="sell" inputMode="decimal" required defaultValue="0" /></label>
            <label className="space-y-1"><span className="text-sm">Btw %</span><Input name="vat" inputMode="decimal" defaultValue="21" required /></label>
            <label className="space-y-1"><span className="text-sm">Interne notitie</span><Input name="notes" /></label>
            <label className="space-y-1 sm:col-span-2"><span className="text-sm">PDF leverancier (intern, gaat niet naar de klant)</span><Input name="pdf" type="file" accept="application/pdf" required /></label>
            <Button type="submit" disabled={busy}>Offerte registreren</Button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Klantofferte</h2>
        <ul className="text-sm space-y-1">
          {dossier.customerQuotes.map((doc) => (
            <li key={doc.id}><a className="underline" href={`/api/documents/${doc.id}/file`}>{doc.name}</a></li>
          ))}
          {dossier.customerQuotes.length === 0 && <li className="text-muted-foreground">Nog geen klantofferte.</li>}
        </ul>
        {!dossier.terminal && (
          <form
            className="flex flex-wrap gap-2 items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const file = new FormData(event.currentTarget).get("pdf");
              if (!(file instanceof File) || file.size === 0) return;
              void run(async () => {
                const uploaded = await uploadPdf(file);
                if ("error" in uploaded) return uploaded;
                return uploadCustomerQuoteAction(dossier.id, uploaded);
              });
            }}
          >
            <Input name="pdf" type="file" accept="application/pdf" required className="max-w-sm" />
            <Button type="submit" variant="secondary" disabled={busy}>Klantofferte opladen</Button>
          </form>
        )}
        {!dossier.terminal && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => markReadyAction(dossier.id))}>
            Offerte klaar
          </Button>
        )}
      </section>

      {!dossier.terminal && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Verzonden registreren</h2>
          <p className="text-sm text-muted-foreground">E-mail vanuit de app volgt later. Noteer hier dat de klantofferte verstuurd is.</p>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void run(() => markSentAction(dossier.id, {
                quoteId: String(data.get("quoteId") ?? ""),
                documentId: String(data.get("documentId") ?? ""),
                followUpDate: String(data.get("followUp") ?? ""),
              }));
            }}
          >
            <label className="space-y-1">
              <span className="text-sm">Versie</span>
              <select name="quoteId" className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm" required>
                <option value="">Kies een versie</option>
                {versions.map((quote) => <option key={quote.id} value={quote.id}>{quote.number} v{quote.version}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm">Klant-PDF</span>
              <select name="documentId" className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm" required>
                <option value="">Kies de klantofferte</option>
                {dossier.customerQuotes.map((doc) => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm">Opvolgdatum</span>
              <Input name="followUp" type="date" required />
            </label>
            <div className="flex items-end">
              <Button type="submit" disabled={busy}>Markeer als verstuurd</Button>
            </div>
          </form>
          {dossier.sends.length > 0 && (
            <ul className="text-sm space-y-1">
              {dossier.sends.map((send) => (
                <li key={send.id}>{send.sentAt.slice(0, 10)} · {send.label} · opvolgen {send.followUp}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Opvolging</h2>
        {!dossier.terminal ? (
          <form
            className="grid gap-3 sm:grid-cols-2"
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
              <span className="text-sm">Opvolgdatum</span>
              <Input name="followUp" type="date" defaultValue={dossier.followUpDate ?? ""} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm">Volgende actie</span>
              <Input name="nextStep" defaultValue={dossier.nextStep ?? ""} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm">Interne notities</span>
              <Input name="notes" defaultValue={dossier.notes ?? ""} />
            </label>
            {status === "VERLOREN" && (
              <label className="space-y-1 sm:col-span-2">
                <span className="text-sm">Reden verloren</span>
                <Input name="lostReason" required />
              </label>
            )}
            {status === "GEWONNEN" && (
              <label className="space-y-1 sm:col-span-2">
                <span className="text-sm">Aanvaarde versie</span>
                <select name="accepted" className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm" required>
                  <option value="">Kies een versie</option>
                  {versions.map((quote) => <option key={quote.id} value={quote.id}>{quote.number} v{quote.version}</option>)}
                </select>
              </label>
            )}
            <Button type="submit" disabled={busy}>Opslaan</Button>
          </form>
        ) : (
          <p className="text-sm">Het verkooppad is gesloten. Er wordt geen order of factuur gemaakt.</p>
        )}
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
      </section>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
