import { SalesError } from "./errors";
import { isProjectGroup, isSellerName, type ProjectGroup, type SellerName } from "./aanvraag-fields";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STAMNUMMER = /^[AB]\d{6}$/;

/** Fields the dossier card can change. The project number is not one of them. */
export type DossierProjectInput = {
  projectName: string;
  sellerName: string;
  projectGroup: string;
  priceRequestDate: string;
  projectStreet?: string;
  projectPostalCode?: string;
  projectCity?: string;
  projectCountry?: string;
  architectName?: string;
  architectExternalId?: string;
};

export type DossierProjectPatch = {
  name: string;
  sellerName: SellerName;
  projectGroup: ProjectGroup;
  priceRequestDate: string;
  projectStreet: string | null;
  projectPostalCode: string | null;
  projectCity: string | null;
  projectCountry: string | null;
  architectName: string | null;
  architectExternalId: string | null;
};

function optionalLine(value: string | undefined, max: number): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  if (text.length > max) throw new SalesError("addressRequired");
  return text;
}

function countryFor(street: string | null, postalCode: string | null, city: string | null, raw: string | undefined): string | null {
  if (!street && !postalCode && !city) return null;
  const text = (raw ?? "").trim();
  if (!text) return "BE";
  if (text.length > 40) throw new SalesError("addressRequired");
  return text.length === 2 ? text.toUpperCase() : text;
}

export function parseDossierProjectDraft(input: DossierProjectInput): DossierProjectPatch {
  const name = (input.projectName ?? "").trim();
  if (!name || name.length > 500) throw new SalesError("projectRequired");
  if (!isSellerName(input.sellerName ?? "")) throw new SalesError("sellerRequired");
  if (!isProjectGroup(input.projectGroup ?? "")) throw new SalesError("projectGroupRequired");
  if (!DAY.test(input.priceRequestDate ?? "")) throw new SalesError("invalidDate");

  const architectName = (input.architectName ?? "").trim();
  const architectExternalId = (input.architectExternalId ?? "").trim();
  if (architectName || architectExternalId) {
    if (!architectName || architectName.length > 200 || !STAMNUMMER.test(architectExternalId)) {
      throw new SalesError("architectInvalid");
    }
  }

  const projectStreet = optionalLine(input.projectStreet, 200);
  const projectPostalCode = optionalLine(input.projectPostalCode, 20);
  const projectCity = optionalLine(input.projectCity, 120);

  return {
    name,
    sellerName: input.sellerName,
    projectGroup: input.projectGroup,
    priceRequestDate: input.priceRequestDate,
    projectStreet,
    projectPostalCode,
    projectCity,
    projectCountry: countryFor(projectStreet, projectPostalCode, projectCity, input.projectCountry),
    architectName: architectName || null,
    architectExternalId: architectExternalId || null,
  };
}
