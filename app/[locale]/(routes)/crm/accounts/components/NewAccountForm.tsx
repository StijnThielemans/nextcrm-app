"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createAccount } from "@/actions/crm/accounts/create-account";
import { CustomerFields, type CustomerDraft } from "@/components/crm/CustomerFields";
import type { AccountRole } from "@/lib/sales/aanvraag-fields";

export function NewAccountForm({ onFinish }: { onFinish: () => void }) {
  const t = useTranslations("Sales");
  async function onSubmit(draft: CustomerDraft) {
    const result = await createAccount({
      name: draft.name,
      account_role: draft.role as AccountRole,
      office_phone: draft.phone,
      mobile_phone: draft.mobile,
      email: draft.email,
      vat: draft.vat,
      vat_choice: draft.vatChoice,
      billing_street: draft.address.street,
      billing_postal_code: draft.address.postalCode,
      billing_city: draft.address.city,
      billing_country: draft.address.country,
    });
    if (result?.error) return result.error;
    toast.success(t("customerCreated"));
    onFinish();
    return null;
  }

  return <CustomerFields layout="overview" submitLabel={t("createCustomer")} onSubmit={onSubmit} />;
}
