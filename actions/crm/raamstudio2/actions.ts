"use server";

import { revalidatePath } from "next/cache";
import { AuthenticationError, AuthorizationError, assertCanReadDocument, requireAuthenticated } from "@/lib/authz";
import { SalesError } from "@/lib/sales/errors";
import { SALES_ERROR_TEXT } from "@/lib/sales/labels";
import { readPlanLayer } from "@/lib/raamstudio2/plan-text";
import { readDocumentBytesById, saveProjectNotes, saveRaamstudio2 } from "@/lib/raamstudio2/store";
import type { Rs2Project } from "@/lib/raamstudio2/project";

export async function saveRaamstudio2Action(dossierId: string, project: Rs2Project) {
  try {
    const user = await requireAuthenticated();
    const saved = await saveRaamstudio2(user, dossierId, project);
    revalidatePath("/[locale]/(routes)/crm/raamstudio-2", "page");
    revalidatePath("/[locale]/(routes)/crm/dossiers/[dossierId]", "page");
    return saved;
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { error: SALES_ERROR_TEXT.forbidden };
    }
    if (error instanceof SalesError) {
      return { error: SALES_ERROR_TEXT[error.code] ?? "Opslaan is mislukt." };
    }
    console.error("[raamstudio2]", error);
    return { error: error instanceof Error ? error.message : "Opslaan is mislukt." };
  }
}

export async function generateProjectnotitiesAction(dossierId: string, project: Rs2Project) {
  try {
    const user = await requireAuthenticated();
    const saved = await saveProjectNotes(user, dossierId, project);
    revalidatePath("/[locale]/(routes)/crm/raamstudio-2", "page");
    revalidatePath("/[locale]/(routes)/crm/dossiers/[dossierId]", "page");
    return saved;
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { error: SALES_ERROR_TEXT.forbidden };
    }
    if (error instanceof SalesError) {
      return { error: SALES_ERROR_TEXT[error.code] ?? "Projectnotities konden niet worden gemaakt." };
    }
    console.error("[raamstudio2]", error);
    return { error: error instanceof Error ? error.message : "Projectnotities konden niet worden gemaakt." };
  }
}

export async function readPlanLayerAction(documentId: string, page: number) {
  try {
    const user = await requireAuthenticated();
    await assertCanReadDocument(user, documentId);
    const bytes = await readDocumentBytesById(documentId);
    if (!bytes) return { error: "Dit plan is niet beschikbaar." };
    return await readPlanLayer(bytes, page);
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { error: SALES_ERROR_TEXT.forbidden };
    }
    console.error("[raamstudio2]", error);
    return { error: "De tekstlaag van dit plan kon niet worden gelezen." };
  }
}
