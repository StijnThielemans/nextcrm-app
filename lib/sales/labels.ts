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

/** Methods for a dossier opvolging. email reuses EMAIL_SELLER so the aanvraag channels stay unchanged. */
export const FOLLOW_UP_CHANNELS = [
  "PHONE",
  "EMAIL_SELLER",
  "SHOWROOM",
  "SITE_VISIT",
] as const satisfies readonly RequestChannel[];

export type FollowUpChannel = (typeof FOLLOW_UP_CHANNELS)[number];

export const FOLLOW_UP_CHANNEL_LABELS: Record<FollowUpChannel, string> = {
  PHONE: "Telefonisch",
  EMAIL_SELLER: "email",
  SHOWROOM: "showroom",
  SITE_VISIT: "plaatsbezoek",
};

export function followUpChannelLabel(channel: string | null | undefined): string {
  if (channel === "EMAIL_OFFERTE" || channel === "EMAIL_SELLER") return FOLLOW_UP_CHANNEL_LABELS.EMAIL_SELLER;
  if (channel && channel in FOLLOW_UP_CHANNEL_LABELS) return FOLLOW_UP_CHANNEL_LABELS[channel as FollowUpChannel];
  return channelLabel(channel);
}

export function euro(value: number): string {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(value);
}

export const DOSSIER_DOCUMENT_CATEGORIES = [
  "BESTELLINGEN",
  "CALCULATIE",
  "DORPELPLANNEN",
  "EPB",
  "FACTURATIE",
  "FOTOS",
  "GARANTIES",
  "GLASLIJSTEN",
  "INTERVENTIE_AFWERKING",
  "LEVERBONNEN",
  "MAILS",
  "OFFERTE",
  "ONDERTEKENDE_OFFERTE",
  "OPMETING",
  "ORDERBEVESTIGING",
  "PLAATSINGSFICHE",
  "PLANNEN",
  "PROJECTNOTITIES",
  "UW_WAARDEN",
  "VORDERINGSSTATEN",
  "WERFVERSLAG",
  "ZAAGLIJSTEN",
  "LASTENBOEK",
  "TEKENWERK",
  "MEETSTAAT",
  "PRIJSAANVRAAG",
  "WERKOPDRACHTEN",
  "POSITIEOVERZICHT",
  "DETAILS",
  "WERFAANGIFTE",
  "LEVERANCIER_OFFERTES",
  "PROJECTFICHE",
  "TECHNISCHE_GEGEVENS",
] as const;

export type DossierDocumentCategory = (typeof DOSSIER_DOCUMENT_CATEGORIES)[number];

export const DOSSIER_DOCUMENT_LABELS: Record<DossierDocumentCategory, string> = {
  BESTELLINGEN: "Bestellingen",
  CALCULATIE: "Calculatie",
  DORPELPLANNEN: "Dorpelplannen",
  EPB: "EPB",
  FACTURATIE: "Facturatie",
  FOTOS: "Fotos",
  GARANTIES: "Garanties",
  GLASLIJSTEN: "Glaslijsten",
  INTERVENTIE_AFWERKING: "Interventie-afwerking",
  LEVERBONNEN: "Leverbonnen",
  MAILS: "Mails",
  OFFERTE: "Offerte",
  ONDERTEKENDE_OFFERTE: "Ondertekende offerte",
  OPMETING: "Opmeting",
  ORDERBEVESTIGING: "Orderbevestiging",
  PLAATSINGSFICHE: "Plaatsingsfiche",
  PLANNEN: "Plannen",
  PROJECTNOTITIES: "Projectnotities",
  UW_WAARDEN: "Uw-waarden",
  VORDERINGSSTATEN: "Vorderingsstaten",
  WERFVERSLAG: "Werfverslag",
  ZAAGLIJSTEN: "Zaaglijsten",
  LASTENBOEK: "Lastenboek",
  TEKENWERK: "Tekenwerk",
  MEETSTAAT: "Meetstaat",
  PRIJSAANVRAAG: "Prijsaanvraag",
  WERKOPDRACHTEN: "Werkopdrachten",
  POSITIEOVERZICHT: "Positieoverzicht",
  DETAILS: "Details",
  WERFAANGIFTE: "Werfaangifte-Check-in at work",
  LEVERANCIER_OFFERTES: "Leverancier offertes",
  PROJECTFICHE: "Projectfiche",
  TECHNISCHE_GEGEVENS: "Technische gegevens",
};

const STORED_DOCUMENT_LABELS: Record<string, string> = {
  PLAN: "Plannen",
  PHOTO: "Fotos",
  CUSTOMER_QUOTE: "Ondertekende offerte",
  INTERNAL_SUPPLIER_QUOTE: "Leverancier offertes",
  CONTRACT: "Contract",
  OFFER: "Offerte",
  OTHER: "Overig",
  INVOICE: "Facturatie",
  RECEIPT: "Facturatie",
};

export function documentCategoryLabel(category: string | null | undefined): string {
  if (category && category in DOSSIER_DOCUMENT_LABELS) {
    return DOSSIER_DOCUMENT_LABELS[category as DossierDocumentCategory];
  }
  if (category && category in STORED_DOCUMENT_LABELS) return STORED_DOCUMENT_LABELS[category];
  return "Overig";
}

/** Map a filing category onto the existing document type, without adding enum values. */
export function systemTypeForFiling(category: DossierDocumentCategory) {
  if (category === "FOTOS") return "PHOTO" as const;
  if (category === "PLANNEN") return "PLAN" as const;
  if (category === "OFFERTE") return "OFFER" as const;
  if (category === "ONDERTEKENDE_OFFERTE") return "CUSTOMER_QUOTE" as const;
  if (category === "LEVERANCIER_OFFERTES") return "INTERNAL_SUPPLIER_QUOTE" as const;
  return "OTHER" as const;
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
  architectInvalid: "Kies een architect uit de lijst.",
  architectUnavailable: "De architectenlijst is even niet bereikbaar. Probeer opnieuw.",
  roleRequired: "Kies een contacttype.",
  addressRequired: "Kies een adres uit de suggesties, of vul straat, postcode en plaats in.",
  phoneRequired: "Telefoonnummer is verplicht.",
  mobileRequired: "Gsm-nummer is verplicht.",
  phoneOrMobileRequired: "Vul een telefoonnummer of een gsm-nummer in.",
  emailRequired: "E-mailadres is verplicht.",
  vatRequired: "BTW-nummer is verplicht.",
  vatChoiceRequired: "Kies BTW: Excl 21%, Excl 6% of Medecontractant.",
  categoryRequired: "Kies een documentcategorie.",
  fileType: "Dit bestandstype is niet toegestaan.",
  mailInvalid: "Dit is geen leesbare e-mail (.eml of .msg).",
  mailNoFile: "Sla de mail eerst op als .eml of .msg.",
  mailTooLarge: "De e-mail is te groot (maximaal 20 MB).",
  lostReason: "Een verliesreden is verplicht (maximaal 500 tekens).",
  notCustomerQuote: "Alleen een klantofferte mag naar de klant. De leveranciersofferte blijft intern.",
  noCustomerQuote: "Laad eerst de klantofferte op.",
  terminal: "Dit dossier is afgesloten.",
  notLost: "Alleen een verloren dossier kan terug open.",
  quoteRequired: "Kies de aanvaarde offerteversie.",
  winnerPrice: "Kies een offerte met een totaal bruto.",
  emailLater: "E-mail vanuit de app volgt later. Registreer de verzending handmatig.",
  pdfOnly: "Alleen een PDF is toegestaan.",
  priceRequired: "Vul het totaal bruto in.",
  notFound: "Niet gevonden.",
  duplicateFamily: "Die leverancier en referentie bestaan al. Maak een nieuwe versie.",
  noSeries: "De nummerreeks voor offertedossiers ontbreekt.",
  projectNotWon: "Alleen een gewonnen dossier kan een project worden.",
};
