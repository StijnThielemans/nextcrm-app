"use client";

import { useEffect, useRef, useState } from "react";
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
  type AddressSuggestion,
  type ProjectGroup,
  type SellerName,
} from "@/lib/sales/aanvraag-fields";
import { createAanvraagAction, searchCustomersAction, suggestAddressesAction } from "@/actions/crm/sales/actions";
import type { CustomerHit } from "@/lib/sales/service";

const today = new Date().toISOString().slice(0, 10);

type AddressValue = {
  query: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
};

const emptyAddress: AddressValue = { query: "", street: "", postalCode: "", city: "", country: "BE" };

function applyCustomerName(current: string, previous: string, next: string) {
  if (!current.trim() || current === previous) return next;
  if (previous && current.startsWith(previous)) return next + current.slice(previous.length);
  return current;
}

function AddressBox({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  required?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const skipQuery = useRef("");

  useEffect(() => {
    const query = value.query.trim();
    if (query.length < 3 || query === skipQuery.current) return;
    const handle = setTimeout(() => {
      void (async () => {
        const result = await suggestAddressesAction(query);
        setSuggestions(result.suggestions);
        setOpen(result.suggestions.length > 0);
      })();
    }, 300);
    return () => clearTimeout(handle);
  }, [value.query]);

  function pick(suggestion: AddressSuggestion) {
    skipQuery.current = suggestion.label;
    onChange({
      query: suggestion.label,
      street: suggestion.street,
      postalCode: suggestion.postalCode,
      city: suggestion.city,
      country: suggestion.country,
    });
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <label className="space-y-1 block">
        <span className="text-sm">{label}</span>
        <Input
          value={value.query}
          autoComplete="street-address"
          placeholder="Begin te typen voor adressuggesties"
          required={required && !value.street}
          onChange={(event) => {
            onChange({ ...value, query: event.target.value });
            setOpen(true);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
        />
      </label>
      {open && suggestions.length > 0 && (
        <ul className="rounded-md border bg-background">
          {suggestions.map((suggestion) => (
            <li key={suggestion.label}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => pick(suggestion)}>
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Suggesties via OpenStreetMap (Photon). De browser kan ook een adres voorstellen.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm">Straat</span>
          <Input value={value.street} required={required} onChange={(event) => onChange({ ...value, street: event.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Postcode</span>
          <Input value={value.postalCode} required={required} onChange={(event) => onChange({ ...value, postalCode: event.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Plaats</span>
          <Input value={value.city} required={required} onChange={(event) => onChange({ ...value, city: event.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Land</span>
          <Input value={value.country} required={required} onChange={(event) => onChange({ ...value, country: event.target.value })} />
        </label>
      </div>
    </div>
  );
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

  function chooseCustomer(hit: CustomerHit) {
    setAccountId(hit.id);
    setShowNew(false);
    setQuery(hit.name);
    setDescription((current) => applyCustomerName(current, prefill, hit.projectLabel));
    setPrefill(hit.projectLabel);
    setHits([]);
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
