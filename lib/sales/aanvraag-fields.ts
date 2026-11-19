export const SELLERS = [
  "Saerens Evi",
  "Haegeman Robbe",
  "Ideler Yannick",
  "Van Doorslaer Merel",
  "De Meersman Stijn",
] as const;

export type SellerName = (typeof SELLERS)[number];

export const PROJECT_GROUPS = [
  "AFHALING",
  "HAROL",
  "NIEUWBOUW",
  "PROJECT",
  "RENOVATIE",
] as const;

export type ProjectGroup = (typeof PROJECT_GROUPS)[number];

export const PROJECT_GROUP_LABELS: Record<ProjectGroup, string> = {
  AFHALING: "Afhaling",
  HAROL: "Harol",
  NIEUWBOUW: "Nieuwbouw",
  PROJECT: "Project",
  RENOVATIE: "Renovatie",
};

export const ACCOUNT_ROLES = ["CUSTOMER", "SUPPLIER", "BOTH"] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = {
  CUSTOMER: "Klant",
  SUPPLIER: "Leverancier",
  BOTH: "Klant en leverancier",
};

export const VAT_CHOICES = ["EXCL_21", "EXCL_6", "MEDECONTRACTANT"] as const;

export type VatChoice = (typeof VAT_CHOICES)[number];

export const VAT_CHOICE_LABELS: Record<VatChoice, string> = {
  EXCL_21: "Excl 21%",
  EXCL_6: "Excl 6%",
  MEDECONTRACTANT: "Medecontractant",
};

export function isSellerName(value: string): value is SellerName {
  return (SELLERS as readonly string[]).includes(value);
}

export function isProjectGroup(value: string): value is ProjectGroup {
  return (PROJECT_GROUPS as readonly string[]).includes(value);
}

export function isAccountRole(value: string): value is AccountRole {
  return (ACCOUNT_ROLES as readonly string[]).includes(value);
}

export function isVatChoice(value: string): value is VatChoice {
  return (VAT_CHOICES as readonly string[]).includes(value);
}

export function vatChoiceLabel(value: string | null | undefined): string {
  if (value && isVatChoice(value)) return VAT_CHOICE_LABELS[value];
  return "";
}

/** undefined = not submitted. null = submitted, but not one of the three choices. */
export function parseVatChoice(value: string | null | undefined): VatChoice | null | undefined {
  if (value === undefined) return undefined;
  if (value && isVatChoice(value)) return value;
  return null;
}

/** "Jan Peeters" with a contact Jan / Peeters becomes "Peeters Jan". */
export function customerProjectLabel(input: {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const first = input.firstName?.trim() ?? "";
  const last = input.lastName?.trim() ?? "";
  if (first && last) return `${last} ${first}`;
  return input.name.trim();
}

function nameKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function matchSellerUser<T extends { id: string; name: string | null }>(
  users: T[],
  chosen: string,
): T | null {
  const key = nameKey(chosen);
  return users.find((user) => user.name && nameKey(user.name) === key) ?? null;
}

export type AddressSuggestion = {
  label: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
};

type PhotonProps = {
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  countrycode?: string;
};

export function siteAddressFromBilling(input: {
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}): AddressSuggestion & { query: string } {
  const street = [input.street?.trim(), input.houseNumber?.trim()].filter(Boolean).join(" ");
  const postalCode = input.postalCode?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  const rawCountry = input.country?.trim() || "BE";
  const country = rawCountry.length === 2 ? rawCountry.toUpperCase() : rawCountry;
  const locality = [postalCode, city].filter(Boolean).join(" ");
  const query = [street, locality].filter(Boolean).join(", ");
  return { query, label: query, street, postalCode, city, country };
}

export function suggestionFromPhoton(props: PhotonProps): AddressSuggestion | null {
  const street = [props.street || props.name, props.housenumber].filter(Boolean).join(" ").trim();
  const city = (props.city || "").trim();
  const postalCode = (props.postcode || "").trim();
  const country = (props.countrycode || "BE").trim().toUpperCase() || "BE";
  if (!street || !city) return null;
  const locality = [postalCode, city].filter(Boolean).join(" ");
  return {
    label: [street, locality].filter(Boolean).join(", "),
    street,
    postalCode,
    city,
    country,
  };
}

export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lat", "50.85");
  url.searchParams.set("lon", "4.35");
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "nextcrm-thielemans" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { features?: { properties?: PhotonProps }[] };
    const seen = new Set<string>();
    const suggestions: AddressSuggestion[] = [];
    for (const feature of body.features ?? []) {
      const suggestion = suggestionFromPhoton(feature.properties ?? {});
      if (!suggestion || seen.has(suggestion.label)) continue;
      seen.add(suggestion.label);
      suggestions.push(suggestion);
    }
    return suggestions;
  } catch {
    return [];
  }
}
