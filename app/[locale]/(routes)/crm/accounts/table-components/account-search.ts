import { ACCOUNT_ROLE_LABELS, type AccountRole } from "@/lib/sales/aanvraag-fields";

/** Fields the customer list search box matches, including the Dutch contact type. */
export type AccountSearchRow = {
  name?: string | null;
  account_role?: string | null;
  office_phone?: string | null;
  mobile_phone?: string | null;
  email?: string | null;
  vat?: string | null;
  billing_street?: string | null;
  billing_postal_code?: string | null;
  billing_city?: string | null;
};

function roleLabel(value: string | null | undefined) {
  if (value && value in ACCOUNT_ROLE_LABELS) {
    return ACCOUNT_ROLE_LABELS[value as AccountRole];
  }
  return "";
}

function compact(value: string) {
  return value.replace(/[\s.\-/]/g, "");
}

export function accountMatchesSearch(row: AccountSearchRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase("nl");
  if (!needle) return true;

  const address = [row.billing_street, row.billing_postal_code, row.billing_city]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(", ");

  const haystack = [
    row.name,
    roleLabel(row.account_role),
    row.office_phone,
    row.mobile_phone,
    row.email,
    row.vat,
    row.billing_street,
    row.billing_postal_code,
    row.billing_city,
    address,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .toLocaleLowerCase("nl");

  if (haystack.includes(needle)) return true;
  const compactNeedle = compact(needle);
  return compactNeedle.length > 0 && compactNeedle !== needle && compact(haystack).includes(compactNeedle);
}
