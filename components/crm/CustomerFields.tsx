"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressBox, emptyAddress, type AddressValue } from "@/components/crm/AddressBox";
import { listCustomerTaxRates } from "@/actions/crm/accounts/tax-rates";
import {
  ACCOUNT_ROLE_LABELS,
  ACCOUNT_ROLES,
  type AccountRole,
} from "@/lib/sales/aanvraag-fields";

export type CustomerDraft = {
  name: string;
  role: AccountRole | "";
  address: AddressValue;
  phone: string;
  mobile: string;
  email: string;
  taxRateId: string;
  vat: string;
};

export function CustomerFields({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<CustomerDraft>;
  submitLabel: string;
  onSubmit: (draft: CustomerDraft) => Promise<string | null>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<AccountRole | "">(initial?.role ?? "");
  const [address, setAddress] = useState<AddressValue>(initial?.address ?? emptyAddress);
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [mobile, setMobile] = useState(initial?.mobile ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [taxRateId, setTaxRateId] = useState(initial?.taxRateId ?? "");
  const [vat, setVat] = useState(initial?.vat ?? "");
  const [taxRates, setTaxRates] = useState<{ id: string; name: string; rate: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let alive = true;
    listCustomerTaxRates().then((rates) => { if (alive) setTaxRates(rates); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const message = await onSubmit({ name, role, address, phone, mobile, email, taxRateId, vat });
    setPending(false);
    if (message) setError(message);
  }

  return (
    <form onSubmit={submit} className="space-y-3 px-4 md:px-10 pb-8">
      <label className="space-y-1 block">
        <span className="text-sm">Naam</span>
        <Input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="space-y-1 block">
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
      <AddressBox label="Adres" value={address} onChange={setAddress} required />
      <label className="space-y-1 block">
        <span className="text-sm">Telefoonnummer</span>
        <Input value={phone} onChange={(event) => setPhone(event.target.value)} required />
      </label>
      <label className="space-y-1 block">
        <span className="text-sm">Gsm-nummer</span>
        <Input value={mobile} onChange={(event) => setMobile(event.target.value)} required />
      </label>
      <label className="space-y-1 block">
        <span className="text-sm">E-mailadres</span>
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label className="space-y-1 block">
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
      <label className="space-y-1 block">
        <span className="text-sm">BTW-nummer</span>
        <Input value={vat} onChange={(event) => setVat(event.target.value)} required />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Opslaan…" : submitLabel}</Button>
    </form>
  );
}
