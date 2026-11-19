"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateAccount } from "@/actions/crm/accounts/update-account";
import { CustomerFields, type CustomerDraft } from "@/components/crm/CustomerFields";
import { isVatChoice, type AccountRole } from "@/lib/sales/aanvraag-fields";

export type AccountFormValues = {
  id: string;
  name?: string | null;
  account_role?: AccountRole | null;
  office_phone?: string | null;
  mobile_phone?: string | null;
  email?: string | null;
  vat?: string | null;
  vat_choice?: string | null;
  billing_street?: string | null;
  billing_postal_code?: string | null;
  billing_city?: string | null;
  billing_country?: string | null;
};

export function UpdateAccountForm({
  initialData,
  open,
}: {
  initialData: AccountFormValues;
  open: (value: boolean) => void;
}) {
  const router = useRouter();
  const t = useTranslations("Sales");
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
      vat_choice: draft.vatChoice,
      billing_street: draft.address.street,
      billing_postal_code: draft.address.postalCode,
      billing_city: draft.address.city,
      billing_country: draft.address.country,
    });
    if (result?.error) return result.error;
    toast.success(t("customerUpdated"));
    open(false);
    router.refresh();
    return null;
  }

  return (
    <CustomerFields
      submitLabel={t("save")}
      initial={{
        name: initialData.name ?? "",
        role: initialData.account_role ?? "",
        phone: initialData.office_phone ?? "",
        mobile: initialData.mobile_phone ?? "",
        email: initialData.email ?? "",
        vat: initialData.vat ?? "",
        vatChoice: initialData.vat_choice && isVatChoice(initialData.vat_choice) ? initialData.vat_choice : "",
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
