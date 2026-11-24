"use server";

import { revalidatePath } from "next/cache";
import { AuthenticationError, requireAuthenticated } from "@/lib/authz";
import { SalesError } from "@/lib/sales/errors";
import { SALES_ERROR_TEXT } from "@/lib/sales/labels";
import {
  assignPlanningCrew,
  createManualPlanningItem,
  deleteManualPlanningItem,
  placePlanningJob,
  removePlanningCrew,
  searchPlanningLinks,
} from "@/lib/sales/planning-data";
import type { PlanningLinkHit } from "@/lib/sales/planning";

function refresh() {
  revalidatePath("/[locale]/(routes)/planning/binnendienst", "page");
  revalidatePath("/[locale]/(routes)/planning/buitendienst", "page");
  revalidatePath("/[locale]/(routes)/planning/dienst-na-verkoop", "page");
}

async function userOrError() {
  try {
    return { user: await requireAuthenticated() };
  } catch (error) {
    if (error instanceof AuthenticationError) return { error: SALES_ERROR_TEXT.forbidden };
    throw error;
  }
}

function fail(error: unknown): { error: string } {
  if (error instanceof SalesError) return { error: SALES_ERROR_TEXT[error.code] ?? "Opslaan is mislukt." };
  console.error("[planning]", error);
  return { error: "Opslaan is mislukt." };
}

export async function searchPlanningLinksAction(query: string): Promise<PlanningLinkHit[]> {
  const auth = await userOrError();
  if ("error" in auth) return [];
  try {
    return await searchPlanningLinks(auth.user, query);
  } catch (error) {
    console.error("[planning]", error);
    return [];
  }
}

export async function createPlanningItemAction(input: { text: string; projectId: string | null; quoteId: string | null }) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await createManualPlanningItem(auth.user, input);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function deletePlanningItemAction(jobId: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await deleteManualPlanningItem(auth.user, jobId);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function placePlanningJobAction(jobId: string, day: string | null) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    const placed = await placePlanningJob(auth.user, jobId, day);
    refresh();
    return { ok: true as const, start: placed.start };
  } catch (error) {
    return fail(error);
  }
}

export async function assignPlanningCrewAction(input: { resource: string; jobId: string; day: string }) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await assignPlanningCrew(auth.user, input);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function removePlanningCrewAction(assignmentId: string) {
  const auth = await userOrError();
  if ("error" in auth) return { error: auth.error };
  try {
    await removePlanningCrew(auth.user, assignmentId);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
