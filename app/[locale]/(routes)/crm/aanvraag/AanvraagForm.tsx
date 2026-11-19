"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHANNEL_LABELS, CHANNELS, type RequestChannel } from "@/lib/sales/labels";
import {
  ACCOUNT_ROLE_LABELS,
  ACCOUNT_ROLES,
  PROJECT_GROUP_LABELS,
  PROJECT_GROUPS,
  SELLERS,
  type AccountRole,
  type ProjectGroup,
  type SellerName,
} from "@/lib/sales/aanvraag-fields";
import { createAanvraagAction, searchArchitectsAction, searchCustomersAction } from "@/actions/crm/sales/actions";
import type { ArchitectHit } from "@/lib/sales/architects";
import type { CustomerHit } from "@/lib/sales/service";
import { AddressBox, emptyAddress, type AddressValue } from "@/components/crm/AddressBox";

const today = new Date().toISOString().slice(0, 10);

function applyCustomerName(current: string, previous: string, next: string) {
  if (!current.trim() || current === previous) return next;
  if (previous && current.startsWith(previous)) return next + current.slice(previous.length);
  return current;
}

export function AanvraagForm({
  projectNumber,
  taxRates,
}: {
  projectNumber: string;
  taxRates: { id: string; name: string; rate: number }[];
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<RequestChannel>("PHONE");
  const [requestDate, setRequestDate] = useState(today);
  const [priceRequestDate, setPriceRequestDate] = useState(today);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [description, setDescription] = useState("");
  const [prefill, setPrefill] = useState("");
  const [seller, setSeller] = useState<SellerName | "">("");
  const [projectGroup, setProjectGroup] = useState<ProjectGroup | "">("");
  const [site, setSite] = useState<AddressValue>(emptyAddress);
  const [architectQuery, setArchitectQuery] = useState("");
  const [architectHits, setArchitectHits] = useState<ArchitectHit[]>([]);
  const [architect, setArchitect] = useState<ArchitectHit | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [role, setRole] = useState<AccountRole | "">("");
  const [customerAddress, setCustomerAddress] = useState<AddressValue>(emptyAddress);
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [taxRateId, setTaxRateId] = useState("");
  const [vat, setVat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    const handle = setTimeout(() => {
      void (async () => {
        const result = await searchCustomersAction(text);
        if (result.error) setError(result.error);
        setHits(result.hits);
      })();
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const text = architectQuery.trim();
    if (text.length < 2 || architect) return;
    const handle = setTimeout(() => {
      void (async () => {
        const result = await searchArchitectsAction(text);
        if (result.error) setError(result.error);
        setArchitectHits(result.hits);
      })();
    }, 300);
    return () => clearTimeout(handle);
  }, [architectQuery, architect]);

  function chooseCustomer(hit: CustomerHit) {
    setAccountId(hit.id);
    setShowNew(false);
    setQuery(hit.name);
    setDescription((current) => applyCustomerName(current, prefill, hit.projectLabel));
    setPrefill(hit.projectLabel);
    setHits([]);
  }

  function chooseArchitect(hit: ArchitectHit) {
    setArchitect(hit);
    setArchitectQuery(hit.name);
    setArchitectHits([]);
  }

  function onCustomerName(value: string) {
    setCustomerName(value);
    if (accountId) return;
    const next = value.trim();
    setDescription((current) => applyCustomerName(current, prefill, next));
    setPrefill(next);
  }

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!accountId && !showNew) {
      setError("Kies een klant of maak een nieuwe klant.");
      return;
    }
    if (!seller || !projectGroup) return;
    setPending(true);
    const result = await createAanvraagAction({
      channel,
      requestDate,
      priceRequestDate,
      accountId: accountId ?? undefined,
      customer: accountId
        ? undefined
        : {
            name: customerName,
            role: role as AccountRole,
            street: customerAddress.street,
            postalCode: customerAddress.postalCode,
            city: customerAddress.city,
            country: customerAddress.country,
            phone,
            mobile,
            email,
            taxRateId,
            vat,
          },
      projectName: description,
      sellerName: seller,
      projectGroup,
      projectStreet: site.street,
      projectPostalCode: site.postalCode,
      projectCity: site.city,
      projectCountry: site.country,
      architectName: architect?.name,
      architectExternalId: architect?.id,
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
        <h2 className="text-lg font-semibold">Offertedossier</h2>
        <label className="space-y-1 block">
          <span className="text-sm">Project-Nr</span>
          <Input value={projectNumber} readOnly disabled />
        </label>
        <div className="space-y-1">
          <span className="text-sm">Klant</span>
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setAccountId(null);
            }}
            placeholder="Zoek een bestaande klant"
            aria-label="Klant"
            role="combobox"
            aria-expanded={hits.length > 0}
          />
          {hits.length > 0 && !accountId && (
            <ul className="rounded-md border" role="listbox">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => chooseCustomer(hit)}>
                    <span className="font-medium">{hit.name}</span>
                    <span className="block text-muted-foreground">
                      {[hit.email, hit.phone, hit.address].filter(Boolean).join(" · ") || "Geen contactgegevens"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {accountId && <p className="text-sm">Geselecteerde klant wordt gekoppeld.</p>}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowNew(true);
              setAccountId(null);
              setHits([]);
            }}
          >
            Nieuwe klant
          </Button>
        </div>
        {showNew && !accountId && (
          <div className="grid gap-3 rounded-md border p-3">
            <h3 className="text-sm font-semibold">Nieuwe klant</h3>
            <label className="space-y-1">
              <span className="text-sm">Naam</span>
              <Input value={customerName} onChange={(event) => onCustomerName(event.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Contacttype</span>
              <select
                className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={role}
                required
                onChange={(event) => setRole(event.target.value as AccountRole)}
              >
                <option value="">Kies</option>
                {ACCOUNT_ROLES.map((item) => (
                  <option key={item} value={item}>{ACCOUNT_ROLE_LABELS[item]}</option>
                ))}
              </select>
            </label>
            <AddressBox label="Adres" value={customerAddress} onChange={setCustomerAddress} required />
            <label className="space-y-1">
              <span className="text-sm">Telefoonnummer</span>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Gsm-nummer</span>
              <Input value={mobile} onChange={(event) => setMobile(event.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-sm">E-mailadres</span>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Belastingstarief</span>
              <select
                className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={taxRateId}
                required
                onChange={(event) => setTaxRateId(event.target.value)}
              >
                <option value="">Kies</option>
                {taxRates.map((rate) => (
                  <option key={rate.id} value={rate.id}>{rate.name} ({rate.rate}%)</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm">BTW-nummer</span>
              <Input value={vat} onChange={(event) => setVat(event.target.value)} required />
            </label>
          </div>
        )}
        <label className="space-y-1 block">
          <span className="text-sm">Projectbeschrijving</span>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} required />
        </label>
        <div className="space-y-1">
          <span className="text-sm">Architect</span>
          <Input
            value={architectQuery}
            onChange={(event) => {
              setArchitectQuery(event.target.value);
              setArchitect(null);
            }}
            placeholder="Zoek een architect op naam of stamnummer"
            aria-label="Architect"
            role="combobox"
            aria-expanded={architectHits.length > 0}
            autoComplete="off"
          />
          {architectHits.length > 0 && !architect && (
            <ul className="rounded-md border" role="listbox">
              {architectHits.map((hit) => (
                <li key={hit.id}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => chooseArchitect(hit)}>
                    <span className="font-medium">{hit.name}</span>
                    <span className="block text-muted-foreground">
                      {[hit.postalCode, hit.city, hit.id].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {architect && (
            <p className="text-sm">Gekozen architect: {architect.name} ({architect.id}).</p>
          )}
          <p className="text-sm text-muted-foreground">Optioneel. Kies een architect uit het register van de Orde.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm">Verkoper</span>
            <select
              className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={seller}
              required
              onChange={(event) => setSeller(event.target.value as SellerName)}
            >
              <option value="">Kies</option>
              {SELLERS.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm">Projectgroep</span>
            <select
              className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={projectGroup}
              required
              onChange={(event) => setProjectGroup(event.target.value as ProjectGroup)}
            >
              <option value="">Kies</option>
              {PROJECT_GROUPS.map((group) => (
                <option key={group} value={group}>{PROJECT_GROUP_LABELS[group]}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm">Datum prijsaanvraag</span>
            <Input type="date" value={priceRequestDate} onChange={(event) => setPriceRequestDate(event.target.value)} required />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Aanvraagdatum</span>
            <Input type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} required />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm">Kanaal</span>
            <select
              className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={channel}
              onChange={(event) => setChannel(event.target.value as RequestChannel)}
            >
              {CHANNELS.map((item) => (
                <option key={item} value={item}>{CHANNEL_LABELS[item]}</option>
              ))}
            </select>
          </label>
        </div>
        <AddressBox label="Werfadres" value={site} onChange={setSite} />
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Opslaan…" : "Dossier aanmaken"}
      </Button>
      <Label className="sr-only">Nieuwe aanvraag</Label>
    </form>
  );
}
