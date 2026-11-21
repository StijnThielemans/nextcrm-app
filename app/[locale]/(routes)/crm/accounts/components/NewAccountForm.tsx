"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createAccount } from "@/actions/crm/accounts/create-account";
import { CustomerFields, type CustomerDraft } from "@/components/crm/CustomerFields";
import { customerProjectLabel, type AccountRole } from "@/lib/sales/aanvraag-fields";
import type { CustomerHit } from "@/lib/sales/service";

export function NewAccountForm({
  onFinish,
  initial,
}: {
  onFinish: (customer?: CustomerHit) => void;
  initial?: Partial<CustomerDraft>;
}) {
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
    if (!result || !("data" in result) || !result.data) {
      return result && "error" in result ? result.error : "Failed to create account";
    }
    const account = result.data;
    toast.success(t("customerCreated"));
    onFinish({
      id: account.id,
      name: account.name,
      email: account.email,
      phone: account.office_phone ?? account.mobile_phone,
      address: [account.billing_street, account.billing_postal_code, account.billing_city].filter(Boolean).join(", "),
      street: account.billing_street,
      postalCode: account.billing_postal_code,
      city: account.billing_city,
      country: account.billing_country,
      state: account.billing_state,
      kind: account.customer_kind,
      projectLabel: customerProjectLabel({ name: account.name }),
    });
    return null;
  }

  return <CustomerFields layout="overview" submitLabel={t("createCustomer")} onSubmit={onSubmit} initial={initial} />;
}
