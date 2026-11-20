"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveRaamstudioProjectAction } from "@/actions/crm/raamstudio/actions";
import type { RaamstudioDossierOpen } from "@/lib/raamstudio/dossier-plans";
import { readRaamstudioPayload } from "@/lib/raamstudio/read-project";
import {
  DRAWING_KINDS,
  EMPTY_DRAFT,
  RAAMINFO_OPTIONS,
  WORKSPACE_STEPS,
  nextWindowNumber,
  openingStep,
  planForStep,
  workspaceFromPayload,
  type WorkspaceDraft,
  type WorkspaceStepId,
} from "@/lib/raamstudio/workspace-model";

const fieldClass =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:border-[hsl(var(--tilo))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tilo)/0.35)]";

export function RaamstudioWorkspace({ dossier }: { dossier: RaamstudioDossierOpen }) {
  const router = useRouter();
  const pdfs = dossier.plans.filter((plan) => plan.kind === "plan");
  const savedFile = dossier.plans.find((plan) => plan.kind === "tc-raam" && plan.name.startsWith("RaamStudio "))
    ?? dossier.plans.find((plan) => plan.kind === "tc-raam")
    ?? null;
  const [step, setStep] = useState<WorkspaceStepId>(() => openingStep(dossier.plans));
  const [activeId, setActiveId] = useState<string | null>(() => planForStep(dossier.plans, openingStep(dossier.plans))?.id ?? null);
  const [draft, setDraft] = useState<WorkspaceDraft>(EMPTY_DRAFT);
  const [floor, setFloor] = useState("0");
  const [drawingKind, setDrawingKind] = useState<string>(DRAWING_KINDS[0]);
  const [drawingName, setDrawingName] = useState("");
  const [category, setCategory] = useState("Onderaansluiting");
  const [infoNumber, setInfoNumber] = useState("");
  const [customText, setCustomText] = useState("");
  const [status, setStatus] = useState(savedFile ? savedFile.name : "Nog niet opgeslagen");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pristine = useRef(true);
  const planKey = pdfs.map((plan) => plan.name).join("\n");
  const active = pdfs.find((plan) => plan.id === activeId) ?? pdfs[0] ?? null;
  const stepMeta = WORKSPACE_STEPS.find((item) => item.id === step) ?? WORKSPACE_STEPS[0];
  const stepIndex = WORKSPACE_STEPS.findIndex((item) => item.id === step);

  useEffect(() => {
    if (!savedFile) return;
    const controller = new AbortController();
    const fileId = savedFile.id;
    const fileName = savedFile.name;
    const names = planKey ? planKey.split("\n") : [];
    void (async () => {
      try {
        const response = await fetch(`/api/documents/${fileId}/file`, { signal: controller.signal });
        if (!response.ok) return;
        const payload = await readRaamstudioPayload(new Uint8Array(await response.arrayBuffer()));
        if (controller.signal.aborted || !pristine.current) return;
        const restored = workspaceFromPayload(payload, names);
        setDraft(restored);
        const level = restored.openings.at(-1)?.floor;
        if (level) setFloor(level);
        if (restored.openings[0]) setInfoNumber(restored.openings[0].number);
        setStatus(fileName);
      } catch {
        if (!controller.signal.aborted) setError("Het opgeslagen .tc-raam kon niet worden gelezen.");
      }
    })();
    return () => controller.abort();
  }, [savedFile, planKey]);

  function touch(next: WorkspaceDraft, nextStatus = "Niet opgeslagen") {
    pristine.current = false;
    setDraft(next);
    setStatus(nextStatus);
    setError(null);
  }

  function go(next: WorkspaceStepId) {
    setStep(next);
    const plan = planForStep(dossier.plans, next);
    if (plan) setActiveId(plan.id);
  }

  function addOpening() {
    if (!active) return;
    const level = floor.trim() || "0";
    const same = draft.openings.filter((item) => item.planName === active.name && item.floor === level);
    const number = nextWindowNumber(same.at(-1)?.number ?? null, level);
    touch({
      ...draft,
      openings: [...draft.openings, { planName: active.name, floor: level, number }],
    });
    if (!infoNumber) setInfoNumber(number);
  }

  function addDrawing() {
    if (!active) return;
    const name = drawingName.trim();
    if (!name) return;
    touch({
      ...draft,
      drawings: [...draft.drawings, { planName: active.name, kind: drawingKind, name }],
    });
    setDrawingName("");
  }

  function placeFacade(number: string) {
    if (!active) return;
    if (draft.facades.some((item) => item.planName === active.name && item.number === number)) return;
    touch({ ...draft, facades: [...draft.facades, { planName: active.name, number }] });
  }

  function setSize(number: string, orientation: "width" | "height", valueMm: string) {
    const others = draft.sizes.filter((item) => !(item.number === number && item.orientation === orientation));
    touch({
      ...draft,
      sizes: valueMm.trim() ? [...others, { number, orientation, valueMm: valueMm.trim() }] : others,
    });
  }

  function addInfo(number: string, text: string) {
    const label = text.trim();
    if (!number || !label) return;
    if (draft.raaminfo.some((item) => item.number === number && item.category === category && item.text === label)) return;
    touch({ ...draft, raaminfo: [...draft.raaminfo, { number, category, text: label }] });
    if (category === "Eigen tekst") setCustomText("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    const result = await saveRaamstudioProjectAction(dossier.id, draft);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    pristine.current = true;
    setStatus(`Opgeslagen in Calculatie: ${result.fileName}`);
    router.refresh();
  }

  const context = [dossier.number, dossier.name, dossier.customer, dossier.siteAddress, dossier.seller].filter(Boolean).join(" · ");
  const openingsHere = active ? draft.openings.filter((item) => item.planName === active.name) : [];
  const numbers = [...new Set(draft.openings.map((item) => item.number))];
  const chosenNumber = numbers.includes(infoNumber) ? infoNumber : (numbers[0] ?? "");
  const infoOptions = RAAMINFO_OPTIONS[category] ?? [];

  return (
    <section className="overflow-hidden rounded-xl border border-black/10 bg-card" data-testid="raamstudio-program">
      <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-3 py-2">
        <div className="min-w-28">
          <p className="text-xs font-semibold tracking-wide">{dossier.projectGroup === "RENOVATIE" ? "RENOVATIE" : "CALCULATIE"}</p>
          <p className="text-[10px] text-muted-foreground">WERKVOORBEREIDING BUITENSCHRIJNWERK</p>
        </div>
        <p className="ml-auto text-[10px] tracking-wide text-muted-foreground">THIELEMANS & CO · TILO</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-black/10 px-2 py-2" data-testid="raamstudio-steps">
        {WORKSPACE_STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "min-w-24 flex-1 rounded-md px-2 py-1.5 text-xs",
              step === item.id ? "bg-[hsl(var(--tilo))] text-white" : "hover:bg-accent",
            )}
            aria-pressed={step === item.id}
            data-testid={`raamstudio-step-${item.id}`}
            onClick={() => go(item.id)}
          >
            {index + 1} · {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-black/10 px-3 py-2">
        <Button type="button" size="sm" onClick={() => void save()} disabled={saving || dossier.locked} data-testid="raamstudio-save">
          {saving ? "Opslaan…" : "Opslaan"}
        </Button>
        <p className="text-xs text-muted-foreground" data-testid="raamstudio-status">{status}</p>
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={stepIndex <= 0} onClick={() => go(WORKSPACE_STEPS[stepIndex - 1].id)}>
            ← Vorige
          </Button>
          <Button type="button" size="sm" disabled={stepIndex >= WORKSPACE_STEPS.length - 1} onClick={() => go(WORKSPACE_STEPS[stepIndex + 1].id)}>
            Volgende →
          </Button>
        </div>
      </div>

      <p className="border-b border-black/10 px-3 py-2 text-xs text-muted-foreground" data-testid="raamstudio-from-dossier">
        De projectgegevens komen uit dit offertedossier. Je vult ze hier niet opnieuw in.
        {context ? ` ${context}` : ""}
      </p>
      <p className="px-3 py-1.5 text-xs">{stepMeta.hint}</p>

      <div className="grid min-h-[640px] lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <div className="border-black/10 lg:border-r">
          <p className="px-3 pt-3 text-xs font-medium">Geïmporteerde PDF&apos;s</p>
          {pdfs.length ? (
            <ul className="p-2" data-testid="raamstudio-plans">
              {pdfs.map((plan) => (
                <li key={plan.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-md px-2 py-2 text-left text-sm",
                      active?.id === plan.id && "bg-accent",
                    )}
                    data-testid={active?.id === plan.id ? "raamstudio-plan-selected" : undefined}
                    onClick={() => setActiveId(plan.id)}
                  >
                    <span className="block">{plan.name}</span>
                    <span className="text-xs text-muted-foreground">{plan.folder}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">Geen plannen op dit dossier.</p>
          )}
        </div>

        <div className="min-h-[520px] bg-neutral-100" data-testid="raamstudio-plan-view">
          {active ? (
            <iframe title={active.name} src={`/api/documents/${active.id}/file`} className="h-full min-h-[520px] w-full bg-white" />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Er is nog geen plan om te openen.</p>
          )}
        </div>

        <div className="border-black/10 p-3 lg:border-l">
          {step === "pdfs" ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">PDF&apos;s van het dossier</p>
              <p>{pdfs.length ? `${pdfs.length} plan${pdfs.length === 1 ? "" : "nen"} staan klaar.` : "Geen plannen."}</p>
              {active ? <p className="text-muted-foreground">Open: {active.name}</p> : null}
            </div>
          ) : null}

          {step === "tekeningen" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Nieuwe selectie</p>
              <p className="text-xs text-muted-foreground">De selectie is de hele pagina. Een rechthoek op de PDF tekenen kan hier nog niet.</p>
              <label className="block text-xs text-muted-foreground">
                Type
                <select className={cn(fieldClass, "mt-1")} value={drawingKind} onChange={(event) => setDrawingKind(event.target.value)}>
                  {DRAWING_KINDS.map((kind) => <option key={kind}>{kind}</option>)}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                Naam
                <Input className="mt-1" value={drawingName} placeholder="bv. Gelijkvloers, Voorgevel" onChange={(event) => setDrawingName(event.target.value)} />
              </label>
              <Button type="button" size="sm" disabled={!active || !drawingName.trim()} onClick={addDrawing} data-testid="raamstudio-add-drawing">
                Selectie toevoegen
              </Button>
              <ul className="space-y-1 text-sm">
                {draft.drawings.map((drawing, index) => (
                  <li key={`${drawing.planName}-${drawing.name}-${index}`} className="flex items-start justify-between gap-2">
                    <span>{drawing.name} · {drawing.kind}</span>
                    <button type="button" className="text-xs text-muted-foreground underline" onClick={() => touch({ ...draft, drawings: draft.drawings.filter((_, i) => i !== index) })}>Weg</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {step === "grondplan" ? (
            <div className="space-y-3" data-testid="raamstudio-marking">
              <p className="text-sm font-medium">Raamopeningen op het grondplan</p>
              <label className="block text-xs text-muted-foreground">
                Verdieping / code
                <Input className="mt-1" value={floor} onChange={(event) => setFloor(event.target.value)} data-testid="raamstudio-floor" />
              </label>
              <Button type="button" size="sm" disabled={!active} onClick={addOpening} data-testid="raamstudio-add-opening">
                Raamopening toevoegen
              </Button>
              <p className="text-xs text-muted-foreground">Het nummer komt bij dit plan. Op een precieze plek in de tekening klikken kan hier nog niet.</p>
              <ul className="space-y-2" data-testid="raamstudio-openings">
                {openingsHere.map((opening, index) => {
                  const at = draft.openings.indexOf(opening);
                  return (
                    <li key={`${opening.number}-${index}`} className="flex items-center gap-2">
                      <Input
                        value={opening.number}
                        aria-label={`Raamnummer ${opening.number}`}
                        onChange={(event) => {
                          const openings = draft.openings.slice();
                          openings[at] = { ...opening, number: event.target.value };
                          touch({ ...draft, openings });
                        }}
                      />
                      <button type="button" className="text-xs text-muted-foreground underline" onClick={() => touch({ ...draft, openings: draft.openings.filter((_, i) => i !== at) })}>Weg</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {step === "gevels" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Nummers op deze gevel of snede</p>
              {numbers.length ? (
                <ul className="space-y-1">
                  {numbers.map((number) => {
                    const placed = active ? draft.facades.some((item) => item.planName === active.name && item.number === number) : false;
                    return (
                      <li key={number}>
                        <Button type="button" size="sm" variant={placed ? "secondary" : "outline"} disabled={!active || placed} onClick={() => placeFacade(number)}>
                          {placed ? `${number} staat erop` : `Plaats ${number}`}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nummer eerst de ramen op het grondplan.</p>
              )}
            </div>
          ) : null}

          {step === "maten" ? (
            <div className="space-y-3" data-testid="raamstudio-sizes">
              <p className="text-sm font-medium">Breedte en hoogte</p>
              <p className="text-xs text-muted-foreground">Alleen millimeter die je zelf invult. Automatisch maten lezen zit hier niet in.</p>
              {numbers.length ? numbers.map((number) => (
                <div key={number} className="space-y-1">
                  <p className="text-sm">{number}</p>
                  <Input
                    inputMode="decimal"
                    placeholder="Breedte (mm)"
                    aria-label={`Breedte ${number}`}
                    value={draft.sizes.find((item) => item.number === number && item.orientation === "width")?.valueMm ?? ""}
                    onChange={(event) => setSize(number, "width", event.target.value)}
                  />
                  <Input
                    inputMode="decimal"
                    placeholder="Hoogte (mm)"
                    aria-label={`Hoogte ${number}`}
                    value={draft.sizes.find((item) => item.number === number && item.orientation === "height")?.valueMm ?? ""}
                    onChange={(event) => setSize(number, "height", event.target.value)}
                  />
                </div>
              )) : <p className="text-sm text-muted-foreground">Nummer eerst de ramen op het grondplan.</p>}
            </div>
          ) : null}

          {step === "raaminfo" ? (
            <div className="space-y-3" data-testid="raamstudio-info">
              <p className="text-sm font-medium">Raaminfo kiezen per categorie</p>
              <label className="block text-xs text-muted-foreground">
                Raamnummer
                <select className={cn(fieldClass, "mt-1")} value={chosenNumber} onChange={(event) => setInfoNumber(event.target.value)} aria-label="Raamnummer">
                  {numbers.map((number) => <option key={number}>{number}</option>)}
                </select>
              </label>
              <select className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Categorie">
                {Object.keys(RAAMINFO_OPTIONS).map((item) => <option key={item}>{item}</option>)}
              </select>
              {category === "Eigen tekst" ? (
                <Input value={customText} placeholder="Typ eigen tekst" onChange={(event) => setCustomText(event.target.value)} />
              ) : null}
              <div className="flex max-h-48 flex-wrap gap-1 overflow-auto">
                {(category === "Eigen tekst" ? (customText.trim() ? [customText.trim()] : []) : infoOptions).map((option) => (
                  <button key={option} type="button" className="rounded-md border px-2 py-1 text-xs hover:bg-accent" disabled={!chosenNumber} onClick={() => addInfo(chosenNumber, option)}>
                    {option}
                  </button>
                ))}
              </div>
              {!numbers.length ? <p className="text-sm text-muted-foreground">Nummer eerst de ramen op het grondplan.</p> : null}
              <ul className="space-y-1 text-sm">
                {draft.raaminfo.map((item, index) => (
                  <li key={`${item.number}-${item.text}-${index}`}>{item.number} · {item.category} · {item.text}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-4 text-xs text-muted-foreground">
            Uitsnede tekenen, een nummer op een exacte plek in de tekening zetten, maten automatisch lezen en een PDF met die aanduidingen exporteren blijven in de desktopapp.
          </p>
        </div>
      </div>

      {error ? <p role="alert" className="px-3 py-2 text-sm text-destructive" data-testid="raamstudio-error">{error}</p> : null}
    </section>
  );
}
