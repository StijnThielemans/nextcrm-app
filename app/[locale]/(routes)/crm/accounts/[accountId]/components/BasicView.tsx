import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AccountDetailActions } from "./AccountDetailActions";
import { ACCOUNT_ROLES, type AccountRole } from "@/lib/sales/aanvraag-fields";

function line(label: string, value: string | null | undefined) {
  return (
    <p>
      <span className="text-muted-foreground">{label} </span>
      {value?.trim() ? value : "—"}
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex w-full justify-between gap-3">
          <CardTitle>{data.name}</CardTitle>
          <AccountDetailActions account={data} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {line(t("contactType"), role)}
        {line(t("address"), address)}
        {line(t("phoneNumber"), data.office_phone)}
        {line(t("mobileNumber"), data.mobile_phone)}
        {line(t("emailAddress"), data.email)}
        {line(t("vat"), tax)}
        {line(t("vatNumber"), data.vat)}
      </CardContent>
    </Card>
  );
}
