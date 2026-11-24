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
    if (document.name === "Projectnotities.pdf") continue;
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

export type RaamstudioDossierOpen = {
  id: string;
  number: string | null;
  name: string | null;
  customer: string | null;
  /** Werfadres as the dossier already stores it. Empty when the dossier has none. */
  siteAddress: string;
  contact: string;
  seller: string | null;
  projectGroup: string | null;
  status: string | null;
  executionProjectNumber: string | null;
  locked: boolean;
  plans: DossierPlanFile[];
  /** The Raamstudio 2.0 project file (.raamstudio). A .tc-raam is not this file. */
  studio2: { id: string; name: string } | null;
};

export async function raamstudioPlansForDossier(user: AuthzUser, dossierId: string): Promise<RaamstudioDossierOpen | null> {
  const dossier = await getDossier(user, dossierId);
  if (!dossier) return null;
  return {
    id: dossier.id,
    number: dossier.number,
    name: dossier.name,
    customer: dossier.customer.name,
    siteAddress: dossier.projectAddress,
    contact: [dossier.customer.phone, dossier.customer.mobile].filter(Boolean).join(" · "),
    seller: dossier.seller,
    projectGroup: dossier.projectGroup,
    status: dossier.status,
    executionProjectNumber: dossier.executionProjectNumber,
    locked: dossier.terminal,
    plans: plansOnDossier(dossier.documents),
    studio2: studio2FileOnDossier(dossier.documents),
  };
}

/** A Raamstudio 2.0 project already stored on the dossier. Plan PDFs are not a project file. */
export function studio2FileOnDossier(documents: DossierPlanSource[]): { id: string; name: string } | null {
  const named = (suffix: string) => documents.find((document) => document.name.toLowerCase().endsWith(suffix));
  const file = named(".raamstudio") ?? named(".rs2");
  return file ? { id: file.id, name: file.name } : null;
}
