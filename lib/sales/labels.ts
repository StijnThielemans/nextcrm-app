export const DOSSIER_STATUSES = [
  "NIEUW",
  "IN_OPMAAK",
  "WACHTEN_OP_INFORMATIE",
  "OFFERTE_KLAAR",
  "OFFERTE_VERSTUURD",
  "OPVOLGING",
  "IN_ONDERHANDELING",
  "GEWONNEN",
  "VERLOREN",
] as const;

export type DossierStatus = (typeof DOSSIER_STATUSES)[number];

export const DOSSIER_STATUS_LABELS: Record<DossierStatus, string> = {
  NIEUW: "Nieuw",
  IN_OPMAAK: "In opmaak",
  WACHTEN_OP_INFORMATIE: "Wachten op informatie",
  OFFERTE_KLAAR: "Offerte klaar",
  OFFERTE_VERSTUURD: "Offerte verstuurd",
  OPVOLGING: "Opvolging",
  IN_ONDERHANDELING: "In onderhandeling",
  GEWONNEN: "Gewonnen",
  VERLOREN: "Verloren",
};

export const OPEN_STATUSES: DossierStatus[] = [
  "NIEUW",
  "IN_OPMAAK",
  "WACHTEN_OP_INFORMATIE",
  "OFFERTE_KLAAR",
  "OFFERTE_VERSTUURD",
  "OPVOLGING",
  "IN_ONDERHANDELING",
];

export const FOLLOW_UP_STATUSES: DossierStatus[] = [
  "OFFERTE_VERSTUURD",
  "OPVOLGING",
  "IN_ONDERHANDELING",
];

export const CHANNELS = [
  "PHONE",
  "EMAIL_OFFERTE",
  "EMAIL_SELLER",
  "SITE_VISIT",
  "SHOWROOM",
] as const;

export type RequestChannel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<RequestChannel, string> = {
  PHONE: "Telefoon",
  EMAIL_OFFERTE: "E-mail offerte@thielemans.be",
  EMAIL_SELLER: "E-mail van de verkoper",
  SITE_VISIT: "Plaatsbezoek",
  SHOWROOM: "Showroom",
};

export function statusLabel(status: string | null | undefined): string {
  if (status && status in DOSSIER_STATUS_LABELS) return DOSSIER_STATUS_LABELS[status as DossierStatus];
  return "—";
}

export function channelLabel(channel: string | null | undefined): string {
  if (channel && channel in CHANNEL_LABELS) return CHANNEL_LABELS[channel as RequestChannel];
  return "—";
}

export function euro(value: number): string {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(value);
}

export const DOSSIER_DOCUMENT_CATEGORIES = [
  "PLAN",
  "PHOTO",
  "CUSTOMER_QUOTE",
  "INTERNAL_SUPPLIER_QUOTE",
  "CONTRACT",
  "OFFER",
  "OTHER",
] as const;

export type DossierDocumentCategory = (typeof DOSSIER_DOCUMENT_CATEGORIES)[number];

export const DOSSIER_DOCUMENT_LABELS: Record<DossierDocumentCategory, string> = {
  PLAN: "Plan",
  PHOTO: "Foto",
  CUSTOMER_QUOTE: "Klantofferte",
  INTERNAL_SUPPLIER_QUOTE: "Leveranciersofferte",
  CONTRACT: "Contract",
  OFFER: "Offerte",
  OTHER: "Overig",
};

export function documentCategoryLabel(category: string | null | undefined): string {
  if (category && category in DOSSIER_DOCUMENT_LABELS) {
    return DOSSIER_DOCUMENT_LABELS[category as DossierDocumentCategory];
  }
  return "Overig";
}

export function percentLabel(value: number | null): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} %`;
}

export const SALES_ERROR_TEXT: Record<string, string> = {
  forbidden: "Je hebt geen toegang.",
  invalidDate: "Datum is ongeldig.",
  invalidAmount: "Bedrag is ongeldig.",
  negativeMoney: "Bedragen mogen niet negatief zijn.",
  vatRange: "Btw-tarief ligt tussen 0 en 100.",
  customerRequired: "Kies een klant of vul een nieuwe klant in.",
  contactPoint: "Vul een e-mail of een telefoonnummer in.",
  nameRequired: "Naam is verplicht.",
  personName: "Voornaam en achternaam zijn verplicht.",
  projectRequired: "Projectbeschrijving is verplicht.",
  channelRequired: "Kies het kanaal van de aanvraag.",
  sellerRequired: "Kies een verkoper.",
  projectGroupRequired: "Kies een projectgroep.",
  roleRequired: "Kies een contacttype.",
  addressRequired: "Kies een adres uit de suggesties, of vul straat, postcode en plaats in.",
  phoneRequired: "Telefoonnummer is verplicht.",
  mobileRequired: "Gsm-nummer is verplicht.",
  emailRequired: "E-mailadres is verplicht.",
  vatRequired: "BTW-nummer is verplicht.",
  taxRateRequired: "Kies een belastingstarief.",
  categoryRequired: "Kies een documentcategorie.",
  fileType: "Dit bestandstype is niet toegestaan.",
  lostReason: "Een verliesreden is verplicht (maximaal 500 tekens).",
  notCustomerQuote: "Alleen een klantofferte mag naar de klant. De leveranciersofferte blijft intern.",
  noCustomerQuote: "Laad eerst de klantofferte op.",
  terminal: "Dit dossier is afgesloten.",
  quoteRequired: "Kies de aanvaarde offerteversie.",
  emailLater: "E-mail vanuit de app volgt later. Registreer de verzending handmatig.",
  pdfOnly: "Alleen een PDF is toegestaan.",
  notFound: "Niet gevonden.",
  duplicateFamily: "Die leverancier en referentie bestaan al. Maak een nieuwe versie.",
  noSeries: "De nummerreeks voor offertedossiers ontbreekt.",
};
