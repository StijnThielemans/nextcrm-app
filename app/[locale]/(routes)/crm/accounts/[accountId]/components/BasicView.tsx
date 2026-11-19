import { getTranslations } from "next-intl/server";
import { AccountDetailActions } from "./AccountDetailActions";
import { ACCOUNT_ROLES, type AccountRole } from "@/lib/sales/aanvraag-fields";

function line(label: string, value: string | null | undefined) {
  return (
    <p className="flex flex-col gap-0.5">
      <span className="text-[0.72rem] text-muted-foreground">{label}</span>
      <span className="text-[0.95rem]">{value?.trim() ? value : "—"}</span>
    </p>
  );
}

export async function BasicView({ data }: { data: any }) {
  const t = await getTranslations("Sales");
  if (!data) return <div>{t("customerNotFound")}</div>;
  const role = data.account_role && (ACCOUNT_ROLES as readonly string[]).includes(data.account_role)
    ? t(`roles.${data.account_role as AccountRole}`)
    : null;
  const address = [data.billing_street, data.billing_postal_code, data.billing_city, data.billing_country].filter(Boolean).join(", ");
  const tax = data.vat_choice && t.has(`vatChoice.${data.vat_choice}`) ? t(`vatChoice.${data.vat_choice}`) : "";

  return (
    <section className="text-sm">
      <div className="mb-3 flex justify-end">
        <AccountDetailActions account={data} />
      </div>
      <div className="grid gap-x-12 gap-y-5 sm:grid-cols-2">
        <div className="space-y-5">
          {line(t("contactType"), role)}
          {line(t("phoneNumber"), data.office_phone)}
          {line(t("mobileNumber"), data.mobile_phone)}
          {line(t("emailAddress"), data.email)}
        </div>
        <div className="space-y-5">
          {line(t("address"), address)}
          {line(t("vat"), tax)}
          {line(t("vatNumber"), data.vat)}
        </div>
      </div>
    </section>
  );
}
