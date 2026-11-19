"use client";

import { toast } from "sonner";
import { createAccount } from "@/actions/crm/accounts/create-account";
import { CustomerFields, type CustomerDraft } from "@/components/crm/CustomerFields";
import type { AccountRole } from "@/lib/sales/aanvraag-fields";

export function NewAccountForm({ onFinish }: { onFinish: () => void }) {
  async function onSubmit(draft: CustomerDraft) {
    const result = await createAccount({
      name: draft.name,
      account_role: draft.role as AccountRole,
      office_phone: draft.phone,
      mobile_phone: draft.mobile,
      email: draft.email,
      vat: draft.vat,
      tax_rate_id: draft.taxRateId,
      billing_street: draft.address.street,
      billing_postal_code: draft.address.postalCode,
      billing_city: draft.address.city,
      billing_country: draft.address.country,
    });
    if (result?.error) return result.error;
    toast.success("Klant aangemaakt");
    onFinish();
    return null;
  }

  return <CustomerFields submitLabel="Klant aanmaken" onSubmit={onSubmit} />;
}
