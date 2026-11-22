"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { requireAuthenticated, AuthenticationError } from "@/lib/authz";
import { suggestAddresses } from "@/lib/sales/aanvraag-fields";
import type { DossierProjectInput } from "@/lib/sales/dossier-project";
import { SalesError } from "@/lib/sales/errors";
import { SALES_ERROR_TEXT, type DossierDocumentCategory, type DossierStatus, type RequestChannel } from "@/lib/sales/labels";
import { addOfferteboxRequest, assignOfferteboxSeller, linkOfferteboxDossier } from "@/lib/sales/offertebox";
import { fileOfferteboxAttachments, listPendingOfferteboxAttachments, type FilingAssignment } from "@/lib/sales/offertebox-filing";
import { assignProjectLeader, setProjectleidingAction } from "@/lib/sales/projectbox-data";
import { createProjectFromWonDossier, setPlanningWorkDays } from "@/lib/sales/projects";
import {
  addChannelEvent,
  changeDossierStatus,
  reopenDossier,
  setQuoteWon,
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
  updateDossierProject,
  attachDossierDocument,
  attachOffertePdf,
  changeDossierDocumentCategory,
  deleteDossierDocument,
  deleteOfferte,
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
  revalidatePath("/[locale]/(routes)/crm/dossiers/[dossierId]", "page");
  revalidatePath("/[locale]/(routes)/crm/offertes", "page");
  revalidatePath("/[locale]/(routes)/crm/dashboard", "page");
  revalidatePath("/[locale]/(routes)/crm/offertebox", "page");
  revalidatePath("/[locale]/(routes)/projectleiding/dashboard", "page");
  revalidatePath("/[locale]/(routes)/projectleiding/projectbox", "page");
  revalidatePath("/[locale]/(routes)/projectleiding/projecten", "page");
  revalidatePath("/[locale]/(routes)/projectleiding/projecten/[projectId]", "page");
  revalidatePath("/[locale]/(routes)/planning/binnendienst", "page");
  revalidatePath("/[locale]/(routes)/planning/buitendienst", "page");
  revalidatePath("/[locale]/(routes)/planning/dienst-na-verkoop", "page");
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
    let pendingAttachments = 0;
    if (offerteboxId) {
      await linkOfferteboxDossier(auth.user, offerteboxId, created.id);
      pendingAttachments = (await listPendingOfferteboxAttachments(auth.user, created.id)).length;
    }
    refresh();
    return { id: created.id, number: created.number, pendingAttachments };
  } catch (error) {
    return await fail(error);
  }
}

export async function addOfferteboxRequestAction(input: { fromName?: string; fromEmail?: string; subject?: string }) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await addOfferteboxRequest(auth.user, input);
    refresh();
    return { ok: true as const };
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

export async function fileOfferteboxAttachmentsAction(dossierId: string, assignments: FilingAssignment[]) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await fileOfferteboxAttachments(auth.user, dossierId, assignments);
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

export async function updateDossierProjectAction(dossierId: string, input: DossierProjectInput) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await updateDossierProject(auth.user, dossierId, input);
    refresh();
    return { ok: true as const };
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

export async function deleteDossierDocumentAction(dossierId: string, documentId: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await deleteDossierDocument(auth.user, dossierId, documentId);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return await fail(error);
  }
}

export async function changeDossierDocumentCategoryAction(
  dossierId: string,
  documentId: string,
  category: DossierDocumentCategory,
) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await changeDossierDocumentCategory(auth.user, dossierId, documentId, category);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return await fail(error);
  }
}

export async function deleteOfferteAction(dossierId: string, quoteId: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await deleteOfferte(auth.user, dossierId, quoteId);
    refresh();
    return { ok: true };
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

export async function setQuoteWonAction(dossierId: string, quoteId: string, won: boolean) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await setQuoteWon(auth.user, dossierId, quoteId, won);
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

export async function setProjectleidingActionAction(dossierId: string, checked: boolean) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await setProjectleidingAction(auth.user, dossierId, checked);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return await fail(error);
  }
}

export async function setPlanningWorkDaysAction(
  projectId: string,
  input: { chassis: number | null; glass: number | null },
) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await setPlanningWorkDays(auth.user, projectId, input);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return await fail(error);
  }
}

export async function assignProjectLeaderAction(dossierId: string, leader: string | null) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await assignProjectLeader(auth.user, dossierId, leader);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return await fail(error);
  }
}

export async function createProjectAction(dossierId: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    const created = await createProjectFromWonDossier(auth.user, dossierId);
    refresh();
    return { ok: true as const, id: created.id, number: created.number };
  } catch (error) {
    return await fail(error);
  }
}

export async function reopenDossierAction(dossierId: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await reopenDossier(auth.user, dossierId);
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
