import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AccountDetailActions } from "./AccountDetailActions";
import { ACCOUNT_ROLE_LABELS, vatChoiceLabel, type AccountRole } from "@/lib/sales/aanvraag-fields";

function line(label: string, value: string | null | undefined) {
  return (
    <p>
      <span className="text-muted-foreground">{label} </span>
      {value?.trim() ? value : "—"}
    </p>
  );
}

export async function BasicView({ data }: { data: any }) {
  if (!data) return <div>Klant niet gevonden</div>;
  const role = data.account_role && data.account_role in ACCOUNT_ROLE_LABELS
    ? ACCOUNT_ROLE_LABELS[data.account_role as AccountRole]
    : null;
  const address = [data.billing_street, data.billing_postal_code, data.billing_city, data.billing_country].filter(Boolean).join(", ");
  const tax = vatChoiceLabel(data.vat_choice);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex w-full justify-between gap-3">
          <CardTitle>{data.name}</CardTitle>
          <AccountDetailActions account={data} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {line("Contacttype", role)}
        {line("Adres", address)}
        {line("Telefoonnummer", data.office_phone)}
        {line("Gsm-nummer", data.mobile_phone)}
        {line("E-mailadres", data.email)}
        {line("BTW", tax)}
        {line("BTW-nummer", data.vat)}
      </CardContent>
    </Card>
  );
}
