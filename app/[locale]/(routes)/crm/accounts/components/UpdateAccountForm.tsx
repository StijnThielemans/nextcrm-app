"use client";

import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { updateAccount } from "@/actions/crm/accounts/update-account";
import { CustomerFields, type CustomerDraft } from "@/components/crm/CustomerFields";
import type { AccountRole } from "@/lib/sales/aanvraag-fields";

export function UpdateAccountForm({
  initialData,
  open,
}: {
  initialData: {
    id: string;
    name?: string | null;
    account_role?: AccountRole | null;
    office_phone?: string | null;
    mobile_phone?: string | null;
    email?: string | null;
    vat?: string | null;
    tax_rate_id?: string | null;
    billing_street?: string | null;
    billing_postal_code?: string | null;
    billing_city?: string | null;
    billing_country?: string | null;
  };
  open: (value: boolean) => void;
}) {
  const router = useRouter();
  const street = initialData.billing_street ?? "";
  const postalCode = initialData.billing_postal_code ?? "";
  const city = initialData.billing_city ?? "";
  const country = initialData.billing_country ?? "BE";

  async function onSubmit(draft: CustomerDraft) {
    const result = await updateAccount({
      id: initialData.id,
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
    toast.success("Klant bijgewerkt");
    open(false);
    router.refresh();
    return null;
  }

  return (
    <CustomerFields
      submitLabel="Opslaan"
      initial={{
        name: initialData.name ?? "",
        role: initialData.account_role ?? "",
        phone: initialData.office_phone ?? "",
        mobile: initialData.mobile_phone ?? "",
        email: initialData.email ?? "",
        vat: initialData.vat ?? "",
        taxRateId: initialData.tax_rate_id ?? "",
        address: {
          query: [street, [postalCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
          street,
          postalCode,
          city,
          country,
        },
      }}
      onSubmit={onSubmit}
    />
  );
}
