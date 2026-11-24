/** Current dossier step from facts already stored. Opvolging starts on calendar day 14 after the first send. */

export const DOSSIER_FOLLOW_UP_AFTER_DAYS = 14;

export type DossierStepId =
  | "NIEUW"
  | "IN_BEHANDELING"
  | "OFFERTE_VERSTUURD"
  | "OPVOLGING"
  | "AFSLUITING"
  | "GEWONNEN"
  | "VERLOREN"
  | "PROJECT_MAKEN";

export type DossierStepState = "complete" | "current" | "upcoming";

export type DossierStep = {
  id: DossierStepId;
  label: string;
  state: DossierStepState;
};

export type DossierStepperInput = {
  hasDocuments: boolean;
  sentAt: string | null;
  status: string | null;
  projectCreated?: boolean;
  now?: Date;
};

const LABELS = {
  NIEUW: "Nieuw",
  IN_BEHANDELING: "In behandeling",
  OFFERTE_VERSTUURD: "Offerte verstuurd",
  OPVOLGING: "Opvolging",
  GEWONNEN: "Gewonnen",
  VERLOREN: "Verloren",
  PROJECT_MAKEN: "Project maken",
  AFSLUITING: "Gewonnen / Verloren",
} as const;

export function calendarDaysSince(sentAt: string, now: Date): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(sentAt);
  if (!match) return 0;
  const sent = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - sent) / 86_400_000);
}

export function earliestSentAt(sends: readonly { sentAt: string }[]): string | null {
  let earliest: string | null = null;
  for (const send of sends) {
    if (!earliest || send.sentAt < earliest) earliest = send.sentAt;
  }
  return earliest;
}

export function buildDossierStepper(input: DossierStepperInput): { steps: DossierStep[]; currentLabel: string } {
  const now = input.now ?? new Date();
  const won = input.status === "GEWONNEN";
  const lost = input.status === "VERLOREN";
  const closed = won || lost;
  const sent = Boolean(input.sentAt);
  const followUp = sent && !closed && input.sentAt != null && calendarDaysSince(input.sentAt, now) >= DOSSIER_FOLLOW_UP_AFTER_DAYS;
  const projectCreated = won && Boolean(input.projectCreated);

  const reached = new Set<DossierStepId>(["NIEUW"]);
  if (input.hasDocuments) reached.add("IN_BEHANDELING");
  if (sent) reached.add("OFFERTE_VERSTUURD");
  if (followUp) reached.add("OPVOLGING");
  if (won) reached.add("GEWONNEN");
  if (lost) reached.add("VERLOREN");
  if (projectCreated) reached.add("PROJECT_MAKEN");

  const steps: { id: DossierStepId; label: string }[] = [
    { id: "NIEUW", label: LABELS.NIEUW },
    { id: "IN_BEHANDELING", label: LABELS.IN_BEHANDELING },
    { id: "OFFERTE_VERSTUURD", label: LABELS.OFFERTE_VERSTUURD },
    { id: "OPVOLGING", label: LABELS.OPVOLGING },
    won
      ? { id: "GEWONNEN", label: LABELS.GEWONNEN }
      : lost
        ? { id: "VERLOREN", label: LABELS.VERLOREN }
        : { id: "AFSLUITING", label: LABELS.AFSLUITING },
  ];
  if (won) steps.push({ id: "PROJECT_MAKEN", label: LABELS.PROJECT_MAKEN });

  let currentIndex = 0;
  steps.forEach((step, index) => {
    if (reached.has(step.id)) currentIndex = index;
  });

  return {
    steps: steps.map((step, index) => ({
      ...step,
      state: index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming",
    })),
    currentLabel: steps[currentIndex]?.label ?? LABELS.NIEUW,
  };
}

/** Statussen die een dossier nu kan hebben. Dit is de lijst op het verkoopdashboard. */
export const DASHBOARD_STEPS = [
  "NIEUW",
  "IN_BEHANDELING",
  "OFFERTE_VERSTUURD",
  "OPVOLGING",
  "GEWONNEN",
  "VERLOREN",
  "PROJECT_MAKEN",
] as const satisfies readonly DossierStepId[];

export type DashboardStep = (typeof DASHBOARD_STEPS)[number];

const DASHBOARD_STEP_IDS = new Set<string>(DASHBOARD_STEPS);

/** De stap waar het dossier nu op staat, gelijk aan de statusbalk. */
export function currentDossierStep(input: DossierStepperInput): DashboardStep {
  const current = buildDossierStepper(input).steps.find((step) => step.state === "current");
  if (current && DASHBOARD_STEP_IDS.has(current.id)) return current.id as DashboardStep;
  return "NIEUW";
}

/** Stored status after Verloren is cleared. Sends win, then documents, otherwise Nieuw. */
export function statusAfterReopen(input: { hasDocuments: boolean; sentAt: string | null }): "NIEUW" | "IN_OPMAAK" | "OFFERTE_VERSTUURD" {
  if (input.sentAt) return "OFFERTE_VERSTUURD";
  if (input.hasDocuments) return "IN_OPMAAK";
  return "NIEUW";
}

export function stepperForDossier(
  dossier: {
    documents: readonly unknown[];
    sends: readonly { sentAt: string }[];
    status: string | null;
    projectCreated?: boolean;
  },
  now?: Date,
) {
  return buildDossierStepper({
    hasDocuments: dossier.documents.length > 0,
    sentAt: earliestSentAt(dossier.sends),
    status: dossier.status,
    projectCreated: dossier.projectCreated,
    now,
  });
}
