"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHANNEL_LABELS, CHANNELS, type RequestChannel } from "@/lib/sales/labels";
import { createAanvraagAction, searchCustomersAction } from "@/actions/crm/sales/actions";
import type { CustomerHit } from "@/lib/sales/service";

const today = new Date().toISOString().slice(0, 10);

export function AanvraagForm() {
  const router = useRouter();
  const [channel, setChannel] = useState<RequestChannel>("PHONE");
  const [requestDate, setRequestDate] = useState(today);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [kind, setKind] = useState<"PRIVATE" | "COMPANY">("PRIVATE");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await createAanvraagAction({
      channel,
      requestDate,
      accountId: accountId ?? undefined,
      customer: accountId
        ? undefined
        : {
            kind,
            name: String(form.get("company") ?? ""),
            firstName: String(form.get("firstName") ?? ""),
            lastName: String(form.get("lastName") ?? ""),
            email: String(form.get("email") ?? ""),
            phone: String(form.get("phone") ?? ""),
            street: String(form.get("street") ?? ""),
            postalCode: String(form.get("postal") ?? ""),
            city: String(form.get("city") ?? ""),
            country: String(form.get("country") ?? "BE"),
          },
      projectName: String(form.get("project") ?? ""),
      projectStreet: String(form.get("projectStreet") ?? ""),
      projectPostalCode: String(form.get("projectPostal") ?? ""),
      projectCity: String(form.get("projectCity") ?? ""),
      projectCountry: String(form.get("projectCountry") ?? "BE"),
      description: String(form.get("description") ?? ""),
      notes: String(form.get("notes") ?? ""),
      nextStep: String(form.get("nextStep") ?? ""),
    });
    setPending(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    if ("id" in result && result.id) router.push(`/crm/dossiers/${result.id}`);
  }

  return (
    <form onSubmit={onCreate} className="space-y-8 max-w-3xl">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Aanvraag</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm">Kanaal</span>
            <select
              className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={channel}
              onChange={(event) => setChannel(event.target.value as RequestChannel)}
            >
              {CHANNELS.map((item) => (
                <option key={item} value={item}>
                  {CHANNEL_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm">Aanvraagdatum</span>
            <Input type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} required />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Klant zoeken</h2>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Naam, e-mail, telefoon, bedrijf of adres"
            aria-label="Zoek klant"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void (async () => {
                setError(null);
                setAccountId(null);
                const result = await searchCustomersAction(query);
                if (result.error) setError(result.error);
                setHits(result.hits);
                setSearched(true);
              })();
            }}
          >
            Zoeken
          </Button>
        </div>
        {searched && hits.length === 0 && <p className="text-sm text-muted-foreground">Geen klant gevonden. Maak een nieuwe klant.</p>}
        <ul className="space-y-2">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${accountId === hit.id ? "border-primary" : ""}`}
                onClick={() => {
                  setAccountId(hit.id);
                  setShowNew(false);
                }}
              >
                <span className="font-medium">{hit.name}</span>
                <span className="block text-muted-foreground">
                  {[hit.email, hit.phone, hit.address].filter(Boolean).join(" · ") || "Geen contactgegevens"}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setShowNew(true);
            setAccountId(null);
          }}
        >
          Nieuwe klant
        </Button>
        {showNew && !accountId && (
          <div className="grid gap-3 sm:grid-cols-2 rounded-md border p-3">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm">Soort</span>
              <select
                className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={kind}
                onChange={(event) => setKind(event.target.value as "PRIVATE" | "COMPANY")}
              >
                <option value="PRIVATE">Particulier</option>
                <option value="COMPANY">Bedrijf</option>
              </select>
            </label>
            {kind === "COMPANY" ? (
              <label className="space-y-1 sm:col-span-2">
                <span className="text-sm">Bedrijfsnaam</span>
                <Input name="company" />
              </label>
            ) : null}
            <label className="space-y-1">
              <span className="text-sm">Voornaam</span>
              <Input name="firstName" />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Achternaam</span>
              <Input name="lastName" />
            </label>
            <label className="space-y-1">
              <span className="text-sm">E-mail</span>
              <Input name="email" type="email" />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Telefoon</span>
              <Input name="phone" />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm">Straat</span>
              <Input name="street" />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Postcode</span>
              <Input name="postal" />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Plaats</span>
              <Input name="city" />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Land</span>
              <Input name="country" defaultValue="BE" />
            </label>
          </div>
        )}
        {accountId && <p className="text-sm">Geselecteerde klant wordt gekoppeld. Geen nieuwe klant.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Offertedossier</h2>
        <label className="space-y-1 block">
          <span className="text-sm">Projectnaam</span>
          <Input name="project" required />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm">Werfadres</span>
            <Input name="projectStreet" />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Postcode</span>
            <Input name="projectPostal" />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Plaats</span>
            <Input name="projectCity" />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Land</span>
            <Input name="projectCountry" defaultValue="BE" />
          </label>
        </div>
        <label className="space-y-1 block">
          <span className="text-sm">Omschrijving</span>
          <Input name="description" />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm">Interne notities</span>
          <Input name="notes" />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm">Volgende actie</span>
          <Input name="nextStep" />
        </label>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Opslaan…" : "Dossier aanmaken"}
      </Button>
      <Label className="sr-only">Nieuwe aanvraag</Label>
    </form>
  );
}
