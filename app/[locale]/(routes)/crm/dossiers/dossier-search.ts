import {
  ACCOUNT_ROLE_LABELS,
  PROJECT_GROUP_LABELS,
  type AccountRole,
  type ProjectGroup,
} from "@/lib/sales/aanvraag-fields";
import { DOSSIER_STATUS_LABELS, type DossierStatus } from "@/lib/sales/labels";

/** Fields the offertedossier list shows and its single search box matches. */
export type DossierSearchRow = {
  id: string;
  number: string | null;
  name: string | null;
  status: string | null;
  stepLabel: string;
  customer: string | null;
  contactType: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  vat: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  seller: string | null;
  architectName: string | null;
  architectExternalId: string | null;
  projectGroup: string | null;
  requestDate: string | null;
  priceRequestDate: string | null;
  followUpDate: string | null;
  projectStreet: string | null;
  projectPostalCode: string | null;
  projectCity: string | null;
  projectCountry: string | null;
};

function text(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function join(parts: (string | null | undefined)[]) {
  return parts.map((part) => text(part)).filter((part) => part.length > 0).join(", ");
}

export function dossierContactType(value: string | null | undefined) {
  if (value && value in ACCOUNT_ROLE_LABELS) return ACCOUNT_ROLE_LABELS[value as AccountRole];
  return "";
}

export function dossierProjectGroup(value: string | null | undefined) {
  if (value && value in PROJECT_GROUP_LABELS) return PROJECT_GROUP_LABELS[value as ProjectGroup];
  return "";
}

export function dossierStatusText(row: Pick<DossierSearchRow, "stepLabel" | "status">) {
  const step = text(row.stepLabel);
  if (step) return step;
  if (row.status && row.status in DOSSIER_STATUS_LABELS) return DOSSIER_STATUS_LABELS[row.status as DossierStatus];
  return "";
}

export function dossierArchitect(row: Pick<DossierSearchRow, "architectName" | "architectExternalId">) {
  const name = text(row.architectName);
  const id = text(row.architectExternalId);
  if (!name) return id;
  return id ? `${name} (${id})` : name;
}

export function dossierAddress(row: Pick<DossierSearchRow, "street" | "postalCode" | "city">) {
  return join([row.street, row.postalCode, row.city]);
}

export function dossierSiteAddress(
  row: Pick<DossierSearchRow, "projectStreet" | "projectPostalCode" | "projectCity" | "projectCountry">,
) {
  return join([row.projectStreet, row.projectPostalCode, row.projectCity, row.projectCountry]);
}

/** Same date the dossier card shows: prijsaanvraag, otherwise the request date. */
export function dossierPriceRequestDate(row: Pick<DossierSearchRow, "priceRequestDate" | "requestDate">) {
  return text(row.priceRequestDate) || text(row.requestDate);
}

function compact(value: string) {
  return value.replace(/[\s.\-/]/g, "");
}

function storedStatusLabel(status: string | null | undefined) {
  if (status && status in DOSSIER_STATUS_LABELS) return DOSSIER_STATUS_LABELS[status as DossierStatus];
  return "";
}

export function dossierMatchesSearch(row: DossierSearchRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase("nl");
  if (!needle) return true;

  const haystack = [
    row.number,
    row.name,
    row.customer,
    dossierContactType(row.contactType),
    row.email,
    row.phone,
    row.mobile,
    row.vat,
    row.street,
    row.postalCode,
    row.city,
    dossierAddress(row),
    row.seller,
    row.architectName,
    row.architectExternalId,
    dossierArchitect(row),
    dossierProjectGroup(row.projectGroup),
    dossierPriceRequestDate(row),
    row.requestDate,
    row.priceRequestDate,
    row.followUpDate,
    row.projectStreet,
    row.projectPostalCode,
    row.projectCity,
    row.projectCountry,
    dossierSiteAddress(row),
    dossierStatusText(row),
    storedStatusLabel(row.status),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .toLocaleLowerCase("nl");

  if (haystack.includes(needle)) return true;
  const compactNeedle = compact(needle);
  return compactNeedle.length > 0 && compact(haystack).includes(compactNeedle);
}
