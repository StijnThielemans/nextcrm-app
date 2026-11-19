import { documentCategoryLabel } from "@/lib/sales/labels";
import { getDossier } from "@/lib/sales/service";
import type { AuthzUser } from "@/lib/authz";

export type DossierPlanSource = {
  id: string;
  name: string;
  category: string | null;
};

export type DossierPlanFile = {
  id: string;
  name: string;
  folder: string;
  /** A .tc-raam is the only file the read-only card can read. A plan PDF stays a plan. */
  kind: "tc-raam" | "plan";
};

function isPdf(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function isTcRaam(name: string): boolean {
  return name.toLowerCase().endsWith(".tc-raam");
}

/**
 * Plans already stored on a dossier. Plannen, a calculatie PDF, and a .tc-raam.
 * Other folders, including offerte-PDF's, stay out. Nothing is added.
 */
export function plansOnDossier(documents: DossierPlanSource[]): DossierPlanFile[] {
  const plans: DossierPlanFile[] = [];
  const seen = new Set<string>();
  for (const document of documents) {
    if (seen.has(document.id)) continue;
    const folder = documentCategoryLabel(document.category);
    const tcRaam = isTcRaam(document.name);
    const inPlannen = folder === "Plannen";
    const calculatiePdf = folder === "Calculatie" && isPdf(document.name);
    if (!tcRaam && !inPlannen && !calculatiePdf) continue;
    seen.add(document.id);
    plans.push({
      id: document.id,
      name: document.name,
      folder,
      kind: tcRaam ? "tc-raam" : "plan",
    });
  }
  return plans;
}

export async function raamstudioPlansForDossier(user: AuthzUser, dossierId: string) {
  const dossier = await getDossier(user, dossierId);
  if (!dossier) return null;
  return {
    id: dossier.id,
    number: dossier.number,
    name: dossier.name,
    plans: plansOnDossier(dossier.documents),
  };
}
