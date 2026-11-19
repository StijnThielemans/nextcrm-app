import { buildDossierStepper } from "../dossier-step";

const now = new Date("2026-11-19T15:00:00.000Z");

function labels(input: Parameters<typeof buildDossierStepper>[0]) {
  const stepper = buildDossierStepper({ now, ...input });
  return {
    current: stepper.currentLabel,
    steps: stepper.steps.map((step) => `${step.label}:${step.state}`),
  };
}

describe("dossier status stepper", () => {
  it("starts on Nieuw when the dossier has no documents and no send", () => {
    expect(labels({ hasDocuments: false, sentAt: null, status: "NIEUW" })).toEqual({
      current: "Nieuw",
      steps: [
        "Nieuw:current",
        "In behandeling:upcoming",
        "Offerte verstuurd:upcoming",
        "Opvolging:upcoming",
        "Gewonnen / Verloren:upcoming",
      ],
    });
  });

  it("moves to In behandeling once a document is on the dossier", () => {
    expect(labels({ hasDocuments: true, sentAt: null, status: "NIEUW" }).current).toBe("In behandeling");
  });

  it("moves to Offerte verstuurd the day after a send, even when documents exist", () => {
    const view = labels({ hasDocuments: true, sentAt: "2026-11-18T09:00:00.000Z", status: "OFFERTE_VERSTUURD" });
    expect(view.current).toBe("Offerte verstuurd");
    expect(view.steps).toEqual([
      "Nieuw:complete",
      "In behandeling:complete",
      "Offerte verstuurd:current",
      "Opvolging:upcoming",
      "Gewonnen / Verloren:upcoming",
    ]);
  });

  it("reaches Opvolging when the send date is 14 calendar days ago and the dossier is still open", () => {
    expect(labels({ hasDocuments: true, sentAt: "2026-11-05T23:59:00.000Z", status: "OFFERTE_VERSTUURD" }).current).toBe("Opvolging");
    expect(labels({ hasDocuments: false, sentAt: "2026-11-04T08:00:00.000Z", status: "OFFERTE_VERSTUURD" }).current).toBe("Opvolging");
  });

  it("stays on Offerte verstuurd on day 13", () => {
    expect(labels({ hasDocuments: true, sentAt: "2026-11-06T00:01:00.000Z", status: "OFFERTE_VERSTUURD" }).current).toBe("Offerte verstuurd");
  });

  it("shows Verloren as the last step and does not add Project maken", () => {
    const view = labels({ hasDocuments: true, sentAt: "2026-11-01T00:00:00.000Z", status: "VERLOREN" });
    expect(view.current).toBe("Verloren");
    expect(view.steps.map((step) => step.split(":")[0])).toEqual([
      "Nieuw",
      "In behandeling",
      "Offerte verstuurd",
      "Opvolging",
      "Verloren",
    ]);
    expect(view.steps.at(-1)).toBe("Verloren:current");
  });

  it("shows Gewonnen as current and Project maken as the next step", () => {
    const view = labels({ hasDocuments: true, sentAt: "2026-11-01T00:00:00.000Z", status: "GEWONNEN" });
    expect(view.current).toBe("Gewonnen");
    expect(view.steps).toEqual([
      "Nieuw:complete",
      "In behandeling:complete",
      "Offerte verstuurd:complete",
      "Opvolging:complete",
      "Gewonnen:current",
      "Project maken:upcoming",
    ]);
  });

  it("makes Project maken current only when a project was actually created", () => {
    const view = labels({
      hasDocuments: true,
      sentAt: "2026-11-01T00:00:00.000Z",
      status: "GEWONNEN",
      projectCreated: true,
    });
    expect(view.current).toBe("Project maken");
    expect(view.steps.at(-2)).toBe("Gewonnen:complete");
    expect(view.steps.at(-1)).toBe("Project maken:current");
  });
});
