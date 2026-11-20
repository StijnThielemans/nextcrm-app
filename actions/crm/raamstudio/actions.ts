"use server";

import { revalidatePath } from "next/cache";
import { AuthenticationError, AuthorizationError, requireAuthenticated } from "@/lib/authz";
import { SalesError } from "@/lib/sales/errors";
import { SALES_ERROR_TEXT } from "@/lib/sales/labels";
import { saveRaamstudioOnDossier } from "@/lib/raamstudio/save-on-dossier";
import type { WorkspaceDraft, WorkspaceStepId } from "@/lib/raamstudio/workspace-model";

export async function saveRaamstudioProjectAction(dossierId: string, draft: WorkspaceDraft, step?: WorkspaceStepId) {
  try {
    const user = await requireAuthenticated();
    const saved = await saveRaamstudioOnDossier(user, dossierId, draft, step);
    revalidatePath("/[locale]/(routes)/crm/raamstudio", "page");
    revalidatePath("/[locale]/(routes)/crm/dossiers/[dossierId]", "page");
    return saved;
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { error: SALES_ERROR_TEXT.forbidden };
    }
    if (error instanceof SalesError) {
      return { error: SALES_ERROR_TEXT[error.code] ?? "Opslaan is mislukt." };
    }
    console.error("[raamstudio]", error);
    return { error: "Opslaan is mislukt." };
  }
}
