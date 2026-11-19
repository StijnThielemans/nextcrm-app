"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressBox, emptyAddress, type AddressValue } from "@/components/crm/AddressBox";
import {
  ACCOUNT_ROLES,
  VAT_CHOICES,
  isVatChoice,
  visibleVatChoice,
  type AccountRole,
  type VatChoice,
} from "@/lib/sales/aanvraag-fields";

export type CustomerDraft = {
  name: string;
  role: AccountRole | "";
  address: AddressValue;
  phone: string;
  mobile: string;
  email: string;
  vatChoice: VatChoice | "";
  vat: string;
};

export function CustomerFields({
  initial,
  submitLabel,
  onSubmit,
  layout = "stack",
}: {
  initial?: Partial<CustomerDraft>;
  submitLabel: string;
  onSubmit: (draft: CustomerDraft) => Promise<string | null>;
  layout?: "stack" | "overview";
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<AccountRole | "">(initial?.role ?? "");
  const [address, setAddress] = useState<AddressValue>(initial?.address ?? emptyAddress);
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [mobile, setMobile] = useState(initial?.mobile ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [vatChoice, setVatChoice] = useState<VatChoice | "">(visibleVatChoice(initial?.vatChoice));
  const [vat, setVat] = useState(initial?.vat ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const t = useTranslations("Sales");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!phone.trim() && !mobile.trim()) {
      setError(t("errors.phoneOrMobileRequired"));
      return;
    }
    if (!isVatChoice(vatChoice)) {
      setError(t("errors.vatChoiceRequired"));
      return;
    }
    setPending(true);
    const message = await onSubmit({ name, role, address, phone, mobile, email, vatChoice, vat });
    setPending(false);
    if (message) setError(message);
  }

  const overview = layout === "overview";
  const field = "space-y-1 block";
  return (
    <form
      onSubmit={submit}
      className={overview ? "grid gap-x-10 gap-y-5 md:grid-cols-2" : "space-y-3 px-4 md:px-10 pb-8"}
    >
      <label className={field}>
        <span className="text-sm">{t("name")}</span>
        <Input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className={field}>
        <span className="text-sm">{t("contactType")}</span>
        <select
          className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          value={role}
          required
          onChange={(event) => setRole(event.target.value as AccountRole)}
        >
          <option value="">{t("choose")}</option>
          {ACCOUNT_ROLES.map((item) => (
            <option key={item} value={item}>{t(`roles.${item}`)}</option>
          ))}
        </select>
      </label>
      <div className={overview ? "md:col-span-2" : undefined}>
        <AddressBox label={t("address")} value={address} onChange={setAddress} required />
      </div>
      <label className={field}>
        <span className="text-sm">{t("phoneNumber")}</span>
        <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label className={field}>
        <span className="text-sm">{t("mobileNumber")}</span>
        <Input value={mobile} onChange={(event) => setMobile(event.target.value)} />
      </label>
      <label className={overview ? `${field} md:col-span-2` : field}>
        <span className="text-sm">{t("emailAddress")}</span>
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label className={field}>
        <span className="text-sm">{t("vat")}</span>
        <select
          className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          value={vatChoice}
          required
          onChange={(event) => setVatChoice(event.target.value as VatChoice)}
        >
          {VAT_CHOICES.map((item) => (
            <option key={item} value={item}>{t(`vatChoice.${item}`)}</option>
          ))}
        </select>
      </label>
      <label className={field}>
        <span className="text-sm">{t("vatNumber")}</span>
        <Input value={vat} onChange={(event) => setVat(event.target.value)} />
      </label>
      {error && <p className={`text-sm text-destructive${overview ? " md:col-span-2" : ""}`}>{error}</p>}
      <div className={overview ? "md:col-span-2" : undefined}>
        <Button type="submit" disabled={pending}>{pending ? t("saving") : submitLabel}</Button>
      </div>
    </form>
  );
}
