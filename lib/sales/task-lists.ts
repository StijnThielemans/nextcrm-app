import { buildDossierStepper } from "./dossier-step";

export type DossierTaskKind = "toMake" | "inProgress" | "followUp";

export type DossierTaskInput = {
  status: string | null;
  hasDocuments: boolean;
  sentAt: string | null;
  followUpDate: string | null;
  now: Date;
  today: string;
};

/** Open work only. Follow-up wins, then dossiers that already hold documents, then new ones still to make. */
export function dossierTaskKind(input: DossierTaskInput): DossierTaskKind | null {
  if (input.status === "GEWONNEN" || input.status === "VERLOREN") return null;
  const step = buildDossierStepper({
    hasDocuments: input.hasDocuments,
    sentAt: input.sentAt,
    status: input.status,
    now: input.now,
  });
  const followUpDue = input.followUpDate != null && input.followUpDate <= input.today;
  if (step.currentLabel === "Opvolging" || followUpDue) return "followUp";
  if (input.hasDocuments) return "inProgress";
  return "toMake";
}
