"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { suggestAddressesAction } from "@/actions/crm/sales/actions";
import type { AddressSuggestion } from "@/lib/sales/aanvraag-fields";

export type AddressValue = {
  query: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
};

export const emptyAddress: AddressValue = { query: "", street: "", postalCode: "", city: "", country: "BE" };

export function AddressBox({
  label,
  value,
  onChange,
  required,
  aside,
  ignoreQuery,
}: {
  label: string;
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  required?: boolean;
  aside?: ReactNode;
  ignoreQuery?: string | null;
}) {
  const inputId = useId();
  const t = useTranslations("Sales");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const skipQuery = useRef("");

  useEffect(() => {
    const query = value.query.trim();
    if (ignoreQuery != null && query === ignoreQuery.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (query.length < 3 || query === skipQuery.current) return;
    const handle = setTimeout(() => {
      void (async () => {
        const result = await suggestAddressesAction(query);
        setSuggestions(result.suggestions);
        setOpen(result.suggestions.length > 0);
      })();
    }, 300);
    return () => clearTimeout(handle);
  }, [ignoreQuery, value.query]);

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
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <label htmlFor={inputId} className="text-sm">{label}</label>
        {aside}
      </div>
      <Input
        id={inputId}
        value={value.query}
        autoComplete="street-address"
        placeholder={t("addressPlaceholder")}
        required={required && !value.street}
        onChange={(event) => {
          onChange({ ...value, query: event.target.value });
          setOpen(true);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
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
      <p className="text-xs text-muted-foreground">{t("addressHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm">{t("street")}</span>
          <Input value={value.street} required={required} onChange={(event) => onChange({ ...value, street: event.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">{t("postalCode")}</span>
          <Input value={value.postalCode} required={required} onChange={(event) => onChange({ ...value, postalCode: event.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">{t("city")}</span>
          <Input value={value.city} required={required} onChange={(event) => onChange({ ...value, city: event.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">{t("country")}</span>
          <Input value={value.country} required={required} onChange={(event) => onChange({ ...value, country: event.target.value })} />
        </label>
      </div>
    </div>
  );
}
