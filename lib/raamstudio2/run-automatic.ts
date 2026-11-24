import type { AuthzUser } from "@/lib/authz";
import { raamstudioPlansForDossier } from "@/lib/raamstudio/dossier-plans";
import { SalesError } from "@/lib/sales/errors";
import { SALES_ERROR_TEXT } from "@/lib/sales/labels";
import { applyAutomatic, assembleStudio, type AnalyzedPage } from "@/lib/raamstudio2/automatic";
import type { Rs2Project } from "@/lib/raamstudio2/project";
import { readDocumentBytesById, saveProjectNotes, saveRaamstudio2 } from "@/lib/raamstudio2/store";
import { analyzePlanDocument } from "@/lib/raamstudio2/vision";

export type AutomaticRun =
  | { project: Rs2Project; fileName: string; notesId: string | null; notesError: string | null; summary: string }
  | { error: string };

/** Read every plan in the dossier, number the found openings and store the project and Projectnotities. */
export async function runAutomaticAnalysis(user: AuthzUser, dossierId: string, existing: Rs2Project): Promise<AutomaticRun> {
  const dossier = await raamstudioPlansForDossier(user, dossierId);
  if (!dossier) return { error: SALES_ERROR_TEXT.notFound };
  if (dossier.locked) return { error: SALES_ERROR_TEXT.terminal };
  const plans = dossier.plans.filter((plan) => plan.kind === "plan" && plan.folder === "Plannen");
  if (!plans.length) return { error: "Geen plannen in de map Plannen." };
  const pages: AnalyzedPage[] = [];
  const problems: string[] = [];
  for (const plan of plans) {
    const bytes = await readDocumentBytesById(plan.id);
    if (!bytes) {
      problems.push(plan.name);
      continue;
    }
    const analyzed = await analyzePlanDocument(bytes);
    if ("error" in analyzed) {
      problems.push(`${plan.name}: ${analyzed.error}`);
      continue;
    }
    analyzed.pages.forEach((page, index) => {
      pages.push({ planId: plan.id, planName: plan.name, page: index + 1, labels: page.labels, openings: page.openings });
    });
  }
  if (!pages.length) return { error: problems.join(" ") || "Geen enkele planpagina kon worden gelezen." };
  let sequence = 0;
  const fresh = assembleStudio(pages, () => `auto-${Date.now().toString(36)}-${sequence++}`);
  const project = applyAutomatic(existing, fresh);
  const saved = await saveRaamstudio2(user, dossierId, project);
  let notesId: string | null = null;
  let notesError: string | null = null;
  if (project.drawings.length) {
    try {
      notesId = (await saveProjectNotes(user, dossierId, project)).id;
    } catch (error) {
      notesError = error instanceof Error ? error.message : "Projectnotities konden niet worden gemaakt.";
    }
  }
  const summary = `${plans.length} plannen, ${project.drawings.length} tekeningen, ${project.openings.length} ramen te controleren, ${project.measures.length} geschreven maten.${problems.length ? ` Niet gelezen: ${problems.join(", ")}.` : ""}`;
  return { project, fileName: saved.fileName, notesId, notesError, summary };
}

export function automaticFailure(error: unknown): string {
  if (error instanceof SalesError) return SALES_ERROR_TEXT[error.code] ?? "De automatische analyse is mislukt.";
  return error instanceof Error ? error.message : "De automatische analyse is mislukt.";
}
