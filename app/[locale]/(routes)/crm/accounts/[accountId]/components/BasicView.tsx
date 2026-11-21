import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AccountDetailActions } from "./AccountDetailActions";
import { AddressLink } from "@/components/crm/AddressLink";
import { ACCOUNT_ROLES, type AccountRole } from "@/lib/sales/aanvraag-fields";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex flex-col gap-px leading-tight">
      <span className="text-[0.72rem] leading-tight text-muted-foreground">{label}</span>
      <span className="text-[0.95rem] leading-tight">{children}</span>
    </p>
  );
}

function shown(value: string | null | undefined) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : "—";
}

export async function BasicView({ data }: { data: any }) {
  const t = await getTranslations("Sales");
  if (!data) return <div>{t("customerNotFound")}</div>;
  const role = data.account_role && (ACCOUNT_ROLES as readonly string[]).includes(data.account_role)
    ? t(`roles.${data.account_role as AccountRole}`)
    : "—";
  const address = [data.billing_street, data.billing_postal_code, data.billing_city].filter(Boolean).join(", ");
  const tax = data.vat_choice && t.has(`vatChoice.${data.vat_choice}`) ? t(`vatChoice.${data.vat_choice}`) : "—";

  return (
    <section className="tilo-frame p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
          {t("customer")}
        </h2>
        <AccountDetailActions account={data} />
      </div>
      <div className="grid gap-x-12 gap-y-1 lg:grid-cols-2">
        <div className="space-y-1">
          <Fact label={t("name")}>{shown(data.name)}</Fact>
          <Fact label={t("contactType")}>{role}</Fact>
          <Fact label={t("address")}><AddressLink address={address} /></Fact>
          <Fact label={t("phone")}>{shown(data.office_phone)}</Fact>
        </div>
        <div className="space-y-1">
          <Fact label={t("gsm")}>{shown(data.mobile_phone)}</Fact>
          <Fact label={t("email")}>{shown(data.email)}</Fact>
          <Fact label={t("vatNumber")}>{shown(data.vat)}</Fact>
          <Fact label={t("vat")}>{tax}</Fact>
        </div>
      </div>
    </section>
  );
}
