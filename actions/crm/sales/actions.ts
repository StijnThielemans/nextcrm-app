"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticated, AuthenticationError } from "@/lib/authz";
import { SalesError } from "@/lib/sales/errors";
import { SALES_ERROR_TEXT, type DossierStatus, type RequestChannel } from "@/lib/sales/labels";
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
  updateDossierFields,
  uploadCustomerQuote,
  type AanvraagInput,
  type QuoteFile,
} from "@/lib/sales/service";

async function userOrError() {
  try {
    return { user: await requireAuthenticated() };
  } catch (error) {
    if (error instanceof AuthenticationError) return { error: "Je bent niet ingelogd." as const };
    throw error;
  }
}

function fail(error: unknown): { error: string } {
  if (error instanceof SalesError) return { error: SALES_ERROR_TEXT[error.code] ?? "Er ging iets mis." };
  console.error("[sales]", error);
  return { error: "Er ging iets mis." };
}

function refresh() {
  revalidatePath("/[locale]/(routes)/crm/dossiers", "page");
  revalidatePath("/[locale]/(routes)/crm/offertes", "page");
  revalidatePath("/[locale]/(routes)/crm/dashboard", "page");
  revalidatePath("/[locale]/(routes)", "page");
}

export async function searchCustomersAction(query: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error, hits: [] };
  try {
    return { hits: await searchCustomers(auth.user, query) };
  } catch (error) {
    const failed = fail(error);
    return { ...failed, hits: [] };
  }
}

export async function createAanvraagAction(input: AanvraagInput) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    const created = await createAanvraag(auth.user, input);
    refresh();
    return { id: created.id, number: created.number };
  } catch (error) {
    return fail(error);
  }
}

export async function loadDossiersAction() {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error, rows: [] };
  try {
    return { rows: await listDossiers(auth.user) };
  } catch (error) {
    const failed = fail(error);
    return { ...failed, rows: [] };
  }
}

export async function loadDossierAction(id: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error, dossier: null };
  try {
    return { dossier: await getDossier(auth.user, id) };
  } catch (error) {
    const failed = fail(error);
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
    return fail(error);
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
    return fail(error);
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
    return fail(error);
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
    return fail(error);
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
    return fail(error);
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
    return fail(error);
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
    return fail(error);
  }
}

export async function loadOffertesAction(filter: { supplier?: string; status?: string }) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error, rows: [] };
  try {
    return { rows: await listOffertes(auth.user, filter) };
  } catch (error) {
    const failed = fail(error);
    return { ...failed, rows: [] };
  }
}

export async function loadDashboardAction() {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error, tiles: null };
  try {
    return { tiles: await getSalesDashboard(auth.user) };
  } catch (error) {
    const failed = fail(error);
    return { ...failed, tiles: null };
  }
}
