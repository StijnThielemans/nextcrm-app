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
  pageRotationOf,
  planForStep,
  rotateNormalizedRect,
  rotatePlanPage,
  suggestedDrawingKind,
  suggestedDrawingName,
  workspaceFromPayload,
  type NormRect,
  type WorkspaceDraft,
  type WorkspaceStepId,
} from "@/lib/raamstudio/workspace-model";
import { PlanSheet, type SheetMark, type SheetPlace } from "./PlanSheet";

const fieldClass =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:border-[hsl(var(--tilo))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tilo)/0.35)]";

const WHOLE_PAGE: NormRect = { x: 0.01, y: 0.01, w: 0.98, h: 0.98 };

export function RaamstudioWorkspace({ dossier }: { dossier: RaamstudioDossierOpen }) {
  const router = useRouter();
  const pdfs = dossier.plans.filter((plan) => plan.kind === "plan");
  const savedFile = dossier.plans.find((plan) => plan.kind === "tc-raam" && plan.name.startsWith("RaamStudio "))
    ?? dossier.plans.find((plan) => plan.kind === "tc-raam")
    ?? null;
  const [step, setStep] = useState<WorkspaceStepId>(() => openingStep(dossier.plans));
  const [activeId, setActiveId] = useState<string | null>(() => planForStep(dossier.plans, openingStep(dossier.plans))?.id ?? null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [draft, setDraft] = useState<WorkspaceDraft>(EMPTY_DRAFT);
  const [floor, setFloor] = useState("0");
  const [drawingKind, setDrawingKind] = useState<string>(() => suggestedDrawingKind(planForStep(dossier.plans, "tekeningen")?.name ?? ""));
  const [drawingName, setDrawingName] = useState(() => suggestedDrawingName(planForStep(dossier.plans, "tekeningen")?.name ?? ""));
  const [pending, setPending] = useState<NormRect | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [category, setCategory] = useState("Onderaansluiting");
  const [infoNumber, setInfoNumber] = useState("");
  const [customText, setCustomText] = useState("");
  const [status, setStatus] = useState(savedFile ? savedFile.name : "Nog niet opgeslagen");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(!savedFile);
  const pristine = useRef(true);
  const canPersist = useRef(!savedFile);
  const draftRef = useRef(draft);
  const saveQueue = useRef(Promise.resolve());
  const planKey = pdfs.map((plan) => plan.name).join("\n");
  const active = pdfs.find((plan) => plan.id === activeId) ?? pdfs[0] ?? null;
  const savedId = savedFile?.id ?? null;
  const savedName = savedFile?.name ?? null;
  const stepMeta = WORKSPACE_STEPS.find((item) => item.id === step) ?? WORKSPACE_STEPS[0];
  const stepIndex = WORKSPACE_STEPS.findIndex((item) => item.id === step);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!savedId) {
      canPersist.current = true;
      setReady(true);
      return;
    }
    canPersist.current = false;
    setReady(false);
    const controller = new AbortController();
    const fileId = savedId;
    const fileName = savedName ?? "RaamStudio";
    const names = planKey ? planKey.split("\n") : [];
    void (async () => {
      try {
        const response = await fetch(`/api/documents/${fileId}/file`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const payload = await readRaamstudioPayload(new Uint8Array(await response.arrayBuffer()));
        if (controller.signal.aborted || !pristine.current) return;
        const restored = workspaceFromPayload(payload, names);
        setDraft(restored);
        const level = restored.openings.at(-1)?.floor;
        if (level) setFloor(level);
        if (restored.openings[0]) setInfoNumber(restored.openings[0].number);
        setStatus(fileName);
        canPersist.current = true;
        setReady(true);
      } catch {
        if (!controller.signal.aborted) setError("Het opgeslagen .tc-raam kon niet worden gelezen.");
      }
    })();
    return () => controller.abort();
  }, [savedId, savedName, planKey]);

  function suggestFor(planName: string) {
    setDrawingKind(suggestedDrawingKind(planName));
    setDrawingName(suggestedDrawingName(planName));
    setPending(null);
  }

  function touch(next: WorkspaceDraft, nextStatus = "Niet opgeslagen") {
    pristine.current = false;
    setDraft(next);
    setStatus(nextStatus);
    setError(null);
  }

  function go(next: WorkspaceStepId) {
    setStep(next);
    setPending(null);
    if (next !== "gevels" && next !== "grondplan") return;
    const preferred = next === "gevels"
      ? draft.drawings.find((item) => item.kind === "Gevel" || item.kind === "Snede")
      : draft.drawings.find((item) => item.kind === "Verdieping / grondplan");
    const plan = preferred
      ? pdfs.find((item) => item.name === preferred.planName) ?? planForStep(dossier.plans, next)
      : planForStep(dossier.plans, next);
    if (plan && plan.id !== active?.id) suggestFor(plan.name);
    if (plan) setActiveId(plan.id);
    setPage(preferred?.page ?? 0);
  }

  function addDrawing() {
    if (!active || !pending) return;
    const name = drawingName.trim();
    if (!name) return;
    const drawing = {
      planName: active.name,
      kind: drawingKind,
      name,
      ...(page ? { page } : {}),
      rect: pending,
    };
    touch({ ...draft, drawings: [...draft.drawings, drawing] });
    setSelectedId(`drawing:${draft.drawings.length}`);
    setPending(null);
    setDrawingName(suggestedDrawingName(active.name));
  }

  function place(mark: SheetPlace) {
    if (!active) return;
    if (step === "grondplan") {
      const level = floor.trim() || "0";
      const same = draft.openings.filter((item) => item.planName === active.name && item.floor === level);
      const number = nextWindowNumber(same.at(-1)?.number ?? null, level);
      const opening = mark.kind === "rect"
        ? {
            planName: active.name,
            floor: level,
            number,
            ...(page ? { page } : {}),
            x: round(mark.x + mark.w / 2),
            y: round(mark.y + mark.h / 2),
            rect: { x: round(mark.x), y: round(mark.y), w: round(mark.w), h: round(mark.h) },
          }
        : { planName: active.name, floor: level, number, ...(page ? { page } : {}), x: round(mark.x), y: round(mark.y) };
      touch({ ...draft, openings: [...draft.openings, opening] });
      setSelectedId(`opening:${draft.openings.length}`);
      setInfoNumber(number);
      return;
    }
    if (step === "gevels") {
      if (!chosenFacade) {
        setStatus("Nummer eerst de ramen op het grondplan.");
        return;
      }
      const next = {
        planName: active.name,
        number: chosenFacade,
        ...(page ? { page } : {}),
        x: round(mark.x),
        y: round(mark.y),
      };
      const at = draft.facades.findIndex((item) => item.number === chosenFacade);
      const facades = draft.facades.slice();
      if (at >= 0) facades[at] = next;
      else facades.push(next);
      touch({ ...draft, facades });
      setSelectedId(`facade:${at >= 0 ? at : draft.facades.length}`);
      setArmed(chosenFacade);
    }
  }

  function moveMark(id: string, next: { x: number; y: number; w?: number; h?: number }) {
    const [kind, indexText] = id.split(":");
    const index = Number(indexText);
    if (kind === "drawing" && next.w != null && next.h != null) {
      const drawings = draft.drawings.slice();
      const current = drawings[index];
      if (!current) return;
      drawings[index] = { ...current, rect: { x: round(next.x), y: round(next.y), w: round(next.w), h: round(next.h) } };
      touch({ ...draft, drawings });
    } else if (kind === "opening") {
      const openings = draft.openings.slice();
      const current = openings[index];
      if (!current) return;
      openings[index] = next.w != null && next.h != null
        ? {
            ...current,
            x: round(next.x + next.w / 2),
            y: round(next.y + next.h / 2),
            rect: { x: round(next.x), y: round(next.y), w: round(next.w), h: round(next.h) },
          }
        : { ...current, x: round(next.x), y: round(next.y) };
      touch({ ...draft, openings });
    } else if (kind === "facade") {
      const facades = draft.facades.slice();
      const current = facades[index];
      if (!current) return;
      facades[index] = { ...current, x: round(next.x), y: round(next.y) };
      touch({ ...draft, facades });
    }
    setSelectedId(id);
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

  function selectMark(id: string | null) {
    setSelectedId(id);
    if (!id) return;
    const [kind, indexText] = id.split(":");
    const index = Number(indexText);
    if (kind === "opening" && draft.openings[index]) {
      setInfoNumber(draft.openings[index].number);
      setPage(draft.openings[index].page ?? 0);
    }
    if (kind === "facade" && draft.facades[index]) {
      setArmed(draft.facades[index].number);
      setInfoNumber(draft.facades[index].number);
    }
  }

  function persist(refresh: boolean) {
    const run = saveQueue.current.then(async () => {
      const next = draftRef.current;
      setSaving(true);
      setError(null);
      try {
        const result = await saveRaamstudioProjectAction(dossier.id, next);
        setSaving(false);
        if ("error" in result) {
          setError(result.error);
          setStatus("Niet opgeslagen");
          return;
        }
        if (draftRef.current === next) {
          pristine.current = true;
          setStatus(`Opgeslagen in Calculatie: ${result.fileName}`);
        }
        if (refresh) router.refresh();
      } catch {
        setSaving(false);
        setError("Opslaan is mislukt.");
        setStatus("Niet opgeslagen");
      }
    });
    saveQueue.current = run.then(() => undefined, () => undefined);
    return run;
  }

  async function save() {
    await persist(true);
  }

  function rotateOpenPage(delta: 90 | -90) {
    if (!active || !canPersist.current) return;
    const next = rotatePlanPage(draftRef.current, active.name, page, delta);
    draftRef.current = next;
    if (pending) setPending(rotateNormalizedRect(pending, delta === 90 ? 90 : 270));
    touch(next, "Draaiing opslaan…");
    void persist(false);
  }

  const context = [dossier.number, dossier.name, dossier.customer, dossier.siteAddress, dossier.seller].filter(Boolean).join(" · ");
  const numbers = [...new Set(draft.openings.map((item) => item.number))];
  const chosenNumber = numbers.includes(infoNumber) ? infoNumber : (numbers[0] ?? "");
  const chosenFacade = armed && numbers.includes(armed)
    ? armed
    : (numbers.find((number) => !draft.facades.some((item) => item.number === number && item.x != null)) ?? numbers[0] ?? "");
  const infoOptions = RAAMINFO_OPTIONS[category] ?? [];
  const mode = step === "tekeningen" ? "draw" : step === "grondplan" ? "opening" : step === "gevels" ? "facade" : "inspect";
  const marks = active ? marksOnPage(draft, active.name, page) : [];

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
            <ul className="max-h-[640px] overflow-auto p-2" data-testid="raamstudio-plans">
              {pdfs.map((plan) => (
                <li key={plan.id}>
                  <button
                    type="button"
                    className={cn("w-full rounded-md px-2 py-2 text-left text-sm", active?.id === plan.id && "bg-accent")}
                    data-testid={active?.id === plan.id ? "raamstudio-plan-selected" : undefined}
                    onClick={() => {
                      if (plan.id !== active?.id) suggestFor(plan.name);
                      setActiveId(plan.id);
                      setPage(0);
                    }}
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

        <div className="flex min-h-[520px] flex-col bg-neutral-100" data-testid="raamstudio-plan-view">
          {pageCount > 1 ? (
            <div className="flex items-center gap-2 border-b border-black/10 bg-white px-2 py-1.5">
              <Button type="button" size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage((value) => value - 1)}>Vorige pagina</Button>
              <span className="text-xs" data-testid="raamstudio-page">Pagina {page + 1} / {pageCount}</span>
              <Button type="button" size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)} data-testid="raamstudio-page-next">Volgende pagina</Button>
            </div>
          ) : null}
          {active ? (
            <PlanSheet
              planId={active.id}
              planName={active.name}
              pdf={active.name.toLowerCase().endsWith(".pdf")}
              page={page}
              mode={mode}
              marks={marks}
              selectedId={selectedId}
              pending={step === "tekeningen" ? pending : null}
              rotation={pageRotationOf(draft, active.name, page)}
              onPageCount={(count) => {
                setPageCount(count);
                setPage((current) => Math.min(current, Math.max(0, count - 1)));
              }}
              onSelect={selectMark}
              onPlace={place}
              onPending={(rect) => {
                setPending({ x: round(rect.x), y: round(rect.y), w: round(rect.w), h: round(rect.h) });
                if (!drawingName.trim()) {
                  const suggestion = suggestedDrawingName(active.name);
                  if (suggestion) setDrawingName(suggestion);
                }
              }}
              onMove={moveMark}
              onRotate={ready ? rotateOpenPage : undefined}
            />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Er is nog geen plan om te openen.</p>
          )}
        </div>

        <div className="border-black/10 p-3 lg:border-l">
          {step === "tekeningen" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Gevels en tekeningen aanduiden</p>
              <p className="text-xs text-muted-foreground">Sleep een kader op de tekening, of neem de hele pagina. Het kader blijft staan.</p>
              <label className="block text-xs text-muted-foreground">
                Type
                <select className={cn(fieldClass, "mt-1")} value={drawingKind} onChange={(event) => setDrawingKind(event.target.value)} aria-label="Type">
                  {DRAWING_KINDS.map((kind) => <option key={kind}>{kind}</option>)}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                Naam
                <Input className="mt-1" value={drawingName} placeholder="bv. Voorgevel, Snede A-A" onChange={(event) => setDrawingName(event.target.value)} aria-label="Naam" />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={!active} onClick={() => setPending(WHOLE_PAGE)} data-testid="raamstudio-whole-page">
                  Hele pagina
                </Button>
                <Button type="button" size="sm" disabled={!active || !pending || !drawingName.trim()} onClick={addDrawing} data-testid="raamstudio-add-drawing">
                  Selectie toevoegen
                </Button>
              </div>
              <ul className="space-y-1 text-sm" data-testid="raamstudio-drawings">
                {draft.drawings.map((drawing, index) => (
                  <li key={`${drawing.planName}-${drawing.name}-${index}`} className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className={cn("text-left", selectedId === `drawing:${index}` && "font-medium")}
                      onClick={() => {
                        const plan = pdfs.find((item) => item.name === drawing.planName);
                        if (plan) setActiveId(plan.id);
                        setPage(drawing.page ?? 0);
                        setSelectedId(`drawing:${index}`);
                      }}
                    >
                      {drawing.name} · {drawing.kind}
                    </button>
                    <button type="button" className="text-xs text-muted-foreground underline" onClick={() => touch({ ...draft, drawings: draft.drawings.filter((_, i) => i !== index) })}>Weg</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {step === "grondplan" ? (
            <div className="space-y-3" data-testid="raamstudio-marking">
              <p className="text-sm font-medium">Raamopeningen op het grondplan</p>
              <p className="text-xs text-muted-foreground">Klik in een opening, of sleep een kader errond. Het nummer komt op de tekening.</p>
              <label className="block text-xs text-muted-foreground">
                Verdieping / code
                <Input className="mt-1" value={floor} onChange={(event) => setFloor(event.target.value)} data-testid="raamstudio-floor" />
              </label>
              <ul className="space-y-2" data-testid="raamstudio-openings">
                {draft.openings.map((opening, index) => (
                  <li key={`${opening.number}-${index}`} className="flex items-center gap-2">
                    <button
                      type="button"
                      className={cn("text-xs text-muted-foreground", selectedId === `opening:${index}` && "text-foreground")}
                      onClick={() => {
                        const plan = pdfs.find((item) => item.name === opening.planName);
                        if (plan) setActiveId(plan.id);
                        setPage(opening.page ?? 0);
                        setSelectedId(`opening:${index}`);
                        setInfoNumber(opening.number);
                      }}
                    >
                      {opening.x == null ? "zonder plek" : "op plan"}
                    </button>
                    <Input
                      value={opening.number}
                      aria-label={`Raamnummer ${opening.number}`}
                      onChange={(event) => {
                        const openings = draft.openings.slice();
                        openings[index] = { ...opening, number: event.target.value };
                        touch({ ...draft, openings });
                      }}
                    />
                    <button type="button" className="text-xs text-muted-foreground underline" onClick={() => touch({ ...draft, openings: draft.openings.filter((_, i) => i !== index) })}>Weg</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {step === "gevels" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Nummers op deze gevel of snede</p>
              <p className="text-xs text-muted-foreground">Kies een nummer en klik op de tekening. Een geplaatst nummer kun je verslepen.</p>
              {draft.drawings.some((item) => item.kind === "Gevel" || item.kind === "Snede") ? (
                <ul className="space-y-1 text-sm">
                  {draft.drawings.map((drawing, index) => drawing.kind === "Gevel" || drawing.kind === "Snede" ? (
                    <li key={`${drawing.name}-${index}`}>
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          const plan = pdfs.find((item) => item.name === drawing.planName);
                          if (plan) setActiveId(plan.id);
                          setPage(drawing.page ?? 0);
                          setSelectedId(`drawing:${index}`);
                        }}
                      >
                        {drawing.name}
                      </button>
                    </li>
                  ) : null)}
                </ul>
              ) : null}
              {numbers.length ? (
                <ul className="space-y-1">
                  {numbers.map((number) => {
                    const placed = draft.facades.some((item) => item.number === number && item.x != null);
                    return (
                      <li key={number}>
                        <Button type="button" size="sm" variant={chosenFacade === number ? "secondary" : "outline"} onClick={() => setArmed(number)}>
                          {placed ? `${number} staat op de tekening` : `Kies ${number}`}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nummer eerst de ramen op het grondplan. De aangeduide gevels blijven zichtbaar.</p>
              )}
            </div>
          ) : null}

          {step === "maten" ? (
            <div className="space-y-3" data-testid="raamstudio-sizes">
              <p className="text-sm font-medium">Breedte en hoogte</p>
              <p className="text-xs text-muted-foreground">Alleen millimeter die je zelf invult. De nummers op de tekening zijn de ramen van de vorige stappen.</p>
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
        </div>
      </div>

      {error ? <p role="alert" className="px-3 py-2 text-sm text-destructive" data-testid="raamstudio-error">{error}</p> : null}
    </section>
  );
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function marksOnPage(draft: WorkspaceDraft, planName: string, page: number): SheetMark[] {
  const marks: SheetMark[] = [];
  draft.drawings.forEach((drawing, index) => {
    if (drawing.planName !== planName || (drawing.page ?? 0) !== page || !drawing.rect) return;
    marks.push({
      id: `drawing:${index}`,
      kind: "drawing",
      label: drawing.name,
      x: drawing.rect.x,
      y: drawing.rect.y,
      w: drawing.rect.w,
      h: drawing.rect.h,
    });
  });
  draft.openings.forEach((opening, index) => {
    if (opening.planName !== planName || (opening.page ?? 0) !== page) return;
    if (opening.rect) {
      marks.push({
        id: `opening:${index}`,
        kind: "opening",
        label: opening.number,
        x: opening.rect.x,
        y: opening.rect.y,
        w: opening.rect.w,
        h: opening.rect.h,
      });
      return;
    }
    if (opening.x == null || opening.y == null) return;
    marks.push({ id: `opening:${index}`, kind: "opening", label: opening.number, x: opening.x, y: opening.y });
  });
  draft.facades.forEach((facade, index) => {
    if (facade.planName !== planName || (facade.page ?? 0) !== page || facade.x == null || facade.y == null) return;
    marks.push({ id: `facade:${index}`, kind: "facade", label: facade.number, x: facade.x, y: facade.y });
  });
  return marks;
}
