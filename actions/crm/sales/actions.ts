"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { requireAuthenticated, AuthenticationError } from "@/lib/authz";
import { suggestAddresses } from "@/lib/sales/aanvraag-fields";
import { SalesError } from "@/lib/sales/errors";
import { SALES_ERROR_TEXT, type DossierDocumentCategory, type DossierStatus, type RequestChannel } from "@/lib/sales/labels";
import { assignOfferteboxSeller, linkOfferteboxDossier } from "@/lib/sales/offertebox";
import {
  addChannelEvent,
  changeDossierStatus,
  createAanvraag,
  getDossier,
  getSalesDashboard,
  listDossiers,
  listOffertes,
  markOfferteKlaar,
  markSent,
  registerExternalQuote,
  searchCustomers,
  searchArchitects,
  updateDossierFields,
  attachDossierDocument,
  attachOffertePdf,
  uploadCustomerQuote,
  type AanvraagInput,
  type QuoteFile,
} from "@/lib/sales/service";

async function userOrError() {
  try {
    return { user: await requireAuthenticated() };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      const t = await getTranslations("Sales");
      return { error: t("errors.unauthorized") };
    }
    throw error;
  }
}

async function fail(error: unknown): Promise<{ error: string; code?: string }> {
  const t = await getTranslations("Sales");
  if (error instanceof SalesError) {
    const key = `errors.${error.code}`;
    return {
      error: t.has(key) ? t(key) : (SALES_ERROR_TEXT[error.code] ?? t("errors.generic")),
      code: error.code,
    };
  }
  console.error("[sales]", error);
  return { error: t("errors.generic") };
}

function refresh() {
  revalidatePath("/[locale]/(routes)/crm/dossiers", "page");
  revalidatePath("/[locale]/(routes)/crm/offertes", "page");
  revalidatePath("/[locale]/(routes)/crm/dashboard", "page");
  revalidatePath("/[locale]/(routes)/crm/offertebox", "page");
  revalidatePath("/[locale]/(routes)", "page");
}

export async function searchCustomersAction(query: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error, hits: [] };
  try {
    return { hits: await searchCustomers(auth.user, query) };
  } catch (error) {
    const failed = await fail(error);
    return { ...failed, hits: [] };
  }
}

export async function searchArchitectsAction(query: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error, hits: [] as Awaited<ReturnType<typeof searchArchitects>> };
  try {
    return { hits: await searchArchitects(auth.user, query) };
  } catch (error) {
    const failed = await fail(error);
    return { ...failed, hits: [] as Awaited<ReturnType<typeof searchArchitects>> };
  }
}

export async function suggestAddressesAction(query: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error, suggestions: [] as Awaited<ReturnType<typeof suggestAddresses>> };
  try {
    return { suggestions: await suggestAddresses(query) };
  } catch (error) {
    const failed = await fail(error);
    return { ...failed, suggestions: [] as Awaited<ReturnType<typeof suggestAddresses>> };
  }
}

export async function createAanvraagAction(input: AanvraagInput, offerteboxId?: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    const created = await createAanvraag(auth.user, input);
    if (offerteboxId) await linkOfferteboxDossier(auth.user, offerteboxId, created.id);
    refresh();
    return { id: created.id, number: created.number };
  } catch (error) {
    return await fail(error);
  }
}

export async function assignOfferteboxSellerAction(id: string, sellerName: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await assignOfferteboxSeller(auth.user, id, sellerName);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return await fail(error);
  }
}

export async function loadDossiersAction() {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error, rows: [] };
  try {
    return { rows: await listDossiers(auth.user) };
  } catch (error) {
    const failed = await fail(error);
    return { ...failed, rows: [] };
  }
}

export async function loadDossierAction(id: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error, dossier: null };
  try {
    return { dossier: await getDossier(auth.user, id) };
  } catch (error) {
    const failed = await fail(error);
    return { ...failed, dossier: null };
  }
}

export async function addChannelAction(dossierId: string, input: { channel: RequestChannel; date: string; note?: string }) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await addChannelEvent(auth.user, dossierId, input);
    refresh();
    return { ok: true };
  } catch (error) {
    return await fail(error);
  }
}

export async function updateDossierAction(
  dossierId: string,
  input: { nextStep?: string; followUpDate?: string; notes?: string; description?: string; lostReason?: string },
) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await updateDossierFields(auth.user, dossierId, input);
    refresh();
    return { ok: true };
  } catch (error) {
    return await fail(error);
  }
}

export async function registerQuoteAction(
  dossierId: string,
  input: {
    familyId?: string;
    supplier?: string;
    configurator?: string;
    supplierReference?: string;
    quoteNumber: string;
    quoteDate: string;
    cost: string;
    sell: string;
    vatRate: string;
    notes?: string;
    file: QuoteFile;
  },
) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    const id = await registerExternalQuote(auth.user, dossierId, input);
    refresh();
    return { id };
  } catch (error) {
    return await fail(error);
  }
}

export async function attachDossierDocumentAction(
  dossierId: string,
  file: QuoteFile & { category: DossierDocumentCategory },
) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    const id = await attachDossierDocument(auth.user, dossierId, file);
    refresh();
    return { id };
  } catch (error) {
    return await fail(error);
  }
}

export async function attachOffertePdfAction(dossierId: string, file: QuoteFile & { grossTotal?: string }) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    const id = await attachOffertePdf(auth.user, dossierId, file);
    refresh();
    return { id };
  } catch (error) {
    return await fail(error);
  }
}

export async function uploadCustomerQuoteAction(dossierId: string, file: QuoteFile) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    const id = await uploadCustomerQuote(auth.user, dossierId, file);
    refresh();
    return { id };
  } catch (error) {
    return await fail(error);
  }
}

export async function markReadyAction(dossierId: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await markOfferteKlaar(auth.user, dossierId);
    refresh();
    return { ok: true };
  } catch (error) {
    return await fail(error);
  }
}

export async function markSentAction(
  dossierId: string,
  input: { quoteId: string; documentId: string; followUpDate: string },
) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await markSent(auth.user, dossierId, input);
    refresh();
    return { ok: true };
  } catch (error) {
    return await fail(error);
  }
}

export async function changeStatusAction(
  dossierId: string,
  input: { status: DossierStatus; lostReason?: string; acceptedQuoteId?: string },
) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await changeDossierStatus(auth.user, dossierId, input);
    refresh();
    return { ok: true };
  } catch (error) {
    return await fail(error);
  }
}

export async function loadOffertesAction(filter: { supplier?: string; status?: string }) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error, rows: [] };
  try {
    return { rows: await listOffertes(auth.user, filter) };
  } catch (error) {
    const failed = await fail(error);
    return { ...failed, rows: [] };
  }
}

export async function loadDashboardAction() {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error, tiles: null };
  try {
    return { tiles: await getSalesDashboard(auth.user) };
  } catch (error) {
    const failed = await fail(error);
    return { ...failed, tiles: null };
  }
}
