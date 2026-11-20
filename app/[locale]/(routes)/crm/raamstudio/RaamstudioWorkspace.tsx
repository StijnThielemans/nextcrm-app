"use client";

import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveRaamstudioProjectAction } from "@/actions/crm/raamstudio/actions";
import type { RaamstudioDossierOpen } from "@/lib/raamstudio/dossier-plans";
import type { WindowMeasure } from "@/lib/raamstudio/opening-measures";
import { localPointInClip, nextSharedNumber, pagePointInClip, reorderItems } from "@/lib/raamstudio/plan-edit";
import { ClipBoard, type ClipNumber } from "./ClipBoard";
import { readRaamstudioPayload } from "@/lib/raamstudio/read-project";
import {
  DRAWING_KINDS,
  EMPTY_DRAFT,
  RAAMINFO_OPTIONS,
  WORKSPACE_STEPS,
  nextWindowNumber,
  openingStep,
  pageRotationOf,
  stepFromActiveStep,
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

function isFacadeClip(drawing: { kind: string; name: string }): boolean {
  if (drawing.kind === "Gevel" || drawing.kind === "Snede") return true;
  return /gevel|snede/i.test(drawing.name);
}

function isFloorClip(drawing: { kind: string; name: string }): boolean {
  if (isFacadeClip(drawing)) return false;
  return drawing.kind === "Verdieping / grondplan" || drawing.kind === "Dakplan";
}

function sheetForMark(
  drawings: WorkspaceDraft["drawings"],
  mark: { planName: string; page?: number; x?: number; y?: number },
  match: (drawing: { kind: string; name: string }) => boolean,
) {
  if (mark.x == null || mark.y == null) return null;
  const same = drawings.filter((drawing) => (
    match(drawing) && drawing.planName === mark.planName && (drawing.page ?? 0) === (mark.page ?? 0)
  ));
  const inside = same.find((drawing) => {
    if (!drawing.rect) return false;
    return mark.x! >= drawing.rect.x && mark.x! <= drawing.rect.x + drawing.rect.w
      && mark.y! >= drawing.rect.y && mark.y! <= drawing.rect.y + drawing.rect.h;
  });
  return inside ?? (same.length === 1 ? same[0] : null);
}

function measureSheets(draft: WorkspaceDraft, pdfs: { id: string; name: string }[]) {
  const grouped = new Map<string, {
    documentId: string;
    page: number;
    name: string;
    role: "floor" | "facade";
    rotation: number;
    marks: { number: string; x: number; y: number }[];
  }>();
  const roles = [
    ["floor", isFloorClip, draft.openings],
    ["facade", isFacadeClip, draft.facades],
  ] as const;
  for (const [role, match, marks] of roles) {
    for (const mark of marks) {
      const drawing = sheetForMark(draft.drawings, mark, match);
      const pdf = drawing ? pdfs.find((plan) => plan.name === drawing.planName) : null;
      if (!drawing || !pdf || mark.x == null || mark.y == null) continue;
      const key = `${role}:${pdf.id}:${drawing.page ?? 0}:${drawing.name}`;
      const sheet = grouped.get(key) ?? {
        documentId: pdf.id,
        page: drawing.page ?? 0,
        name: drawing.name,
        role,
        rotation: pageRotationOf(draft, drawing.planName, drawing.page ?? 0),
        marks: [],
      };
      sheet.marks.push({ number: mark.number, x: mark.x, y: mark.y });
      grouped.set(key, sheet);
    }
  }
  return [...grouped.values()];
}

function shortDossierNumber(number: string | null): string {
  if (!number) return "Zonder nummer";
  return number.replace(/^OFF-\d{4}-/, "");
}

export function RaamstudioWorkspace({
  dossier,
  dossiers = [],
  onDirtyChange,
}: {
  dossier: RaamstudioDossierOpen;
  dossiers?: { id: string; number: string | null; name: string | null }[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const pdfs = dossier.plans.filter((plan) => plan.kind === "plan");
  const savedFile = dossier.plans.find((plan) => plan.kind === "tc-raam" && plan.name.startsWith("RaamStudio "))
    ?? dossier.plans.find((plan) => plan.kind === "tc-raam")
    ?? null;
  const [step, setStep] = useState<WorkspaceStepId>(() => openingStep(dossier.plans));
  const stepRef = useRef(step);
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
  const [measures, setMeasures] = useState<WindowMeasure[]>([]);
  const pristine = useRef(true);
  const canPersist = useRef(!savedFile);
  const draftRef = useRef(draft);
  const saveQueue = useRef(Promise.resolve());
  const planKey = pdfs.map((plan) => plan.name).join("\n");
  const pdfsRef = useRef(pdfs);
  const measureKey = [
    ...draft.openings.map((item) => `o:${item.number}:${item.planName}:${item.page ?? 0}:${item.x ?? ""}:${item.y ?? ""}`),
    ...draft.facades.map((item) => `f:${item.number}:${item.planName}:${item.page ?? 0}:${item.x ?? ""}:${item.y ?? ""}`),
  ].join("|");
  const active = pdfs.find((plan) => plan.id === activeId) ?? pdfs[0] ?? null;
  const savedId = savedFile?.id ?? null;
  const savedName = savedFile?.name ?? null;
  const stepIndex = WORKSPACE_STEPS.findIndex((item) => item.id === step);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const stopBrowserZoom = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
    };
    window.addEventListener("wheel", stopBrowserZoom, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", stopBrowserZoom, { capture: true });
  }, []);

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
        const savedStep = stepFromActiveStep(payload.active_step) ?? openingStep([]);
        stepRef.current = savedStep;
        setStep(savedStep);
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

  useEffect(() => {
    pdfsRef.current = pdfs;
  }, [pdfs]);

  useEffect(() => {
    if (!ready || !measureKey) return;
    const controller = new AbortController();
    const sheets = measureSheets(draftRef.current, pdfsRef.current);
    if (!sheets.length) return;
    void (async () => {
      try {
        const response = await fetch("/api/crm/raamstudio/measures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheets }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json() as { measures?: WindowMeasure[] };
        if (!controller.signal.aborted && Array.isArray(data.measures)) setMeasures(data.measures);
      } catch {
        if (!controller.signal.aborted) setMeasures([]);
      }
    })();
    return () => controller.abort();
  }, [ready, measureKey]);

  function suggestFor(planName: string) {
    setDrawingKind(suggestedDrawingKind(planName));
    setDrawingName(suggestedDrawingName(planName));
    setPending(null);
  }

  function touch(next: WorkspaceDraft, nextStatus = "Niet opgeslagen") {
    pristine.current = false;
    onDirtyChange?.(true);
    setDraft(next);
    setStatus(nextStatus);
    setError(null);
  }

  function go(next: WorkspaceStepId) {
    const changed = stepRef.current !== next;
    stepRef.current = next;
    setStep(next);
    setPending(null);
    if (changed) {
      pristine.current = false;
      onDirtyChange?.(true);
      setStatus("Niet opgeslagen");
      setError(null);
    }
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

  function openDrawing(index: number) {
    const drawing = draft.drawings[index];
    if (!drawing) return;
    const plan = pdfs.find((item) => item.name === drawing.planName);
    if (plan) setActiveId(plan.id);
    setPage(drawing.page ?? 0);
    setSelectedId(`drawing:${index}`);
  }

  function placeOnClip(index: number, localX: number, localY: number) {
    const drawing = draft.drawings[index];
    if (!drawing?.rect) return;
    const point = pagePointInClip(drawing.rect, localX, localY);
    const page = drawing.page ?? 0;
    if (step === "gevels" && isFacadeClip(drawing)) {
      if (!chosenFacade) {
        setStatus("Kies links een nummer van het grondplan.");
        return;
      }
      const at = draft.facades.findIndex((item) => (
        item.number === chosenFacade
        && item.planName === drawing.planName
        && (item.page ?? 0) === page
        && item.x != null
        && item.y != null
        && localPointInClip(drawing.rect, item.x, item.y).inside
      ));
      const marker = {
        planName: drawing.planName,
        number: chosenFacade,
        ...(page ? { page } : {}),
        x: point.x,
        y: point.y,
      };
      const facades = draft.facades.slice();
      if (at >= 0) facades[at] = marker;
      else facades.push(marker);
      touch({ ...draft, facades });
      setSelectedId(`facade:${at >= 0 ? at : facades.length - 1}`);
      return;
    }
    if (drawing.kind === "Verdieping / grondplan" || drawing.kind === "Dakplan") {
      const level = floor.trim() || "0";
      const same = draft.openings.filter((item) => item.floor === level);
      const number = nextWindowNumber(same.at(-1)?.number ?? null, level);
      touch({
        ...draft,
        openings: [...draft.openings, {
          planName: drawing.planName,
          floor: level,
          number,
          ...(page ? { page } : {}),
          x: point.x,
          y: point.y,
        }],
      });
      setSelectedId(`opening:${draft.openings.length}`);
      return;
    }
    const used = new Set(draft.facades.filter((item) => item.planName === drawing.planName && (item.page ?? 0) === page).map((item) => item.number));
    const number = nextSharedNumber(draft.openings.map((item) => item.number), used);
    if (!number) {
      setStatus(draft.openings.length ? "Alle grondplannummers staan al op dit knipsel." : "Nummer eerst de ramen op een grondplan.");
      return;
    }
    touch({
      ...draft,
      facades: [...draft.facades, {
        planName: drawing.planName,
        number,
        ...(page ? { page } : {}),
        x: point.x,
        y: point.y,
      }],
    });
    setSelectedId(`facade:${draft.facades.length}`);
  }

  function removeClipNumber(id: string) {
    const [kind, indexText] = id.split(":");
    const index = Number(indexText);
    if (kind === "opening") touch({ ...draft, openings: draft.openings.filter((_, item) => item !== index) });
    if (kind === "facade") touch({ ...draft, facades: draft.facades.filter((_, item) => item !== index) });
  }

  function reorderDrawings(from: number, to: number) {
    const selectedIndex = selectedId?.startsWith("drawing:") ? Number(selectedId.slice("drawing:".length)) : -1;
    const selected = selectedIndex >= 0 ? draft.drawings[selectedIndex] : null;
    const drawings = reorderItems(draft.drawings, from, to);
    touch({ ...draft, drawings });
    if (selected) {
      const nextIndex = drawings.indexOf(selected);
      setSelectedId(nextIndex >= 0 ? `drawing:${nextIndex}` : null);
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
        const result = await saveRaamstudioProjectAction(dossier.id, next, stepRef.current);
        setSaving(false);
        if ("error" in result) {
          setError(result.error);
          setStatus("Niet opgeslagen");
          return;
        }
        if (draftRef.current === next) {
          pristine.current = true;
          onDirtyChange?.(false);
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
      <div className="border-b border-black/10" data-testid="raamstudio-header">
        <div className="flex flex-wrap items-center gap-2 px-2 py-1">
          <Link
            href={`/crm/dossiers/${dossier.id}`}
            data-testid="raamstudio-dossier-link"
            className="shrink-0 text-sm underline decoration-[hsl(var(--tilo))] underline-offset-4"
            onClick={(event) => {
              if (pristine.current) return;
              if (!window.confirm("De wijzigingen in RaamStudio zijn nog niet opgeslagen. Toch naar het dossier gaan?")) event.preventDefault();
            }}
          >
            <span className="font-medium" data-testid="raamstudio-dossier-selected">{shortDossierNumber(dossier.number)}</span>
            <span className="text-muted-foreground"> · {dossier.name ?? "Zonder projectbeschrijving"}</span>
          </Link>
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Ander dossier
            <select
              className="h-7 max-w-[14rem] rounded-md border border-input bg-card px-1.5 text-xs text-foreground"
              value={dossier.id}
              aria-label="Ander dossier"
              data-testid="raamstudio-dossier-switch"
              onChange={(event) => {
                const next = event.target.value;
                if (next === dossier.id) return;
                if (!pristine.current && !window.confirm("De wijzigingen in RaamStudio zijn nog niet opgeslagen. Toch een ander dossier openen?")) return;
                router.push(`/crm/raamstudio?dossier=${next}`);
              }}
            >
              {dossiers.map((item) => (
                <option key={item.id} value={item.id}>
                  {shortDossierNumber(item.number)} · {item.name ?? "Zonder projectbeschrijving"}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={() => void save()} disabled={saving || dossier.locked} data-testid="raamstudio-save">
            {saving ? "Opslaan…" : "Opslaan"}
          </Button>
          <p className="min-w-0 truncate text-[11px] text-muted-foreground" data-testid="raamstudio-status">{status}</p>
          <div className="ml-auto flex gap-1">
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={stepIndex <= 0} onClick={() => go(WORKSPACE_STEPS[stepIndex - 1].id)}>
              ← Vorige
            </Button>
            <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={stepIndex >= WORKSPACE_STEPS.length - 1} onClick={() => go(WORKSPACE_STEPS[stepIndex + 1].id)}>
              Volgende →
            </Button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-2 pb-1" data-testid="raamstudio-steps">
          {WORKSPACE_STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "min-w-0 flex-1 rounded-md px-2 py-1 text-[11px]",
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
      </div>

      <div className={cn(
        "grid min-h-[640px]",
        step === "tekeningen" ? "lg:grid-cols-[220px_minmax(0,1fr)_300px]"
          : step === "gevels" ? "lg:grid-cols-[200px_minmax(0,1fr)_340px]"
            : step === "grondplan" ? "lg:grid-cols-[200px_minmax(0,1fr)]"
              : "lg:grid-cols-[minmax(0,0.7fr)_minmax(460px,1.15fr)]",
      )}>
        {step === "tekeningen" ? (
        <div className="border-black/10 lg:border-r" data-testid="raamstudio-plan-list">
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
        ) : null}

        {step === "grondplan" ? (
          <div className="border-black/10 p-3 lg:border-r" data-testid="raamstudio-opening-numbers">
            <p className="text-sm font-medium">Nummering</p>
            <label className="mt-2 block text-xs text-muted-foreground">
              Verdieping / code
              <Input className="mt-1 h-8" value={floor} onChange={(event) => setFloor(event.target.value)} data-testid="raamstudio-floor" />
            </label>
            {draft.openings.length ? (
              <ul className="mt-3 space-y-1" data-testid="raamstudio-openings">
                {draft.openings.map((opening, index) => (
                  <li key={`${opening.number}-${index}`} className="flex items-center gap-1">
                    <span className="w-12 shrink-0 text-xs font-medium" data-testid="raamstudio-opening-number" data-number={opening.number}>{opening.number}</span>
                    <button type="button" className="ml-auto text-[11px] text-muted-foreground underline" onClick={() => touch({ ...draft, openings: draft.openings.filter((_, item) => item !== index) })}>Weg</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Klik op een grondplan. Het volgende nummer komt op die plek.</p>
            )}
          </div>
        ) : null}

        {step === "gevels" ? (
          <div className="border-black/10 p-3 lg:border-r" data-testid="raamstudio-ground-numbers">
            <p className="text-sm font-medium">Nummering</p>
            <label className="mt-2 block text-xs text-muted-foreground">
              Verdieping / code
              <Input className="mt-1 h-8" value={floor} onChange={(event) => setFloor(event.target.value)} data-testid="raamstudio-floor" />
            </label>
            {numbers.length ? (
              <ul className="mt-3 space-y-1" data-testid="raamstudio-openings">
                {numbers.map((number) => (
                  <li key={number} className="flex items-center gap-1">
                    <button
                      type="button"
                      className={cn("min-w-0 flex-1 rounded px-1 py-0.5 text-left text-xs", chosenFacade === number && "bg-accent font-medium")}
                      data-testid="raamstudio-ground-number"
                      data-number={number}
                      aria-pressed={chosenFacade === number}
                      onClick={() => setArmed(number)}
                    >
                      {number}
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground underline"
                      onClick={() => touch({
                        ...draft,
                        openings: draft.openings.filter((item) => item.number !== number),
                        facades: draft.facades.filter((item) => item.number !== number),
                      })}
                    >
                      Weg
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Nummer eerst de ramen op het grondplan.</p>
            )}
          </div>
        ) : null}

        <div className="flex min-h-[520px] min-w-0 flex-col overflow-auto bg-neutral-100" data-testid="raamstudio-plan-view">
          {step === "tekeningen" && pageCount > 1 ? (
            <div className="flex items-center gap-2 border-b border-black/10 bg-white px-2 py-1.5">
              <Button type="button" size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage((value) => value - 1)}>Vorige pagina</Button>
              <span className="text-xs" data-testid="raamstudio-page">Pagina {page + 1} / {pageCount}</span>
              <Button type="button" size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)} data-testid="raamstudio-page-next">Volgende pagina</Button>
            </div>
          ) : null}
          {step === "grondplan" ? (
            <ClipBoard
              clips={visibleClips(draft.drawings, pdfs, isFloorClip)}
              planNames={draft.drawings.map((drawing) => drawing.planName)}
              numbers={clipNumbers(draft)}
              onPlace={placeOnClip}
              onMove={(id, x, y) => moveMark(id, { x, y })}
              onRemove={removeClipNumber}
              emptyText="Duid eerst in stap 1 een grondplan aan. Gevels en snedes staan hier niet."
            />
          ) : step === "gevels" ? (
            <ClipBoard
              clips={visibleClips(draft.drawings, pdfs, isFacadeClip)}
              planNames={draft.drawings.map((drawing) => drawing.planName)}
              numbers={clipNumbers(draft)}
              onPlace={placeOnClip}
              onMove={(id, x, y) => moveMark(id, { x, y })}
              onRemove={removeClipNumber}
              emptyText="Duid eerst in stap 1 een gevel of snede aan. De grondplannen staan rechts als overzicht."
            />
          ) : step !== "tekeningen" ? (
            <p className="p-6 text-sm text-muted-foreground" data-testid="raamstudio-clips-hint">
              De lijst met PDF&apos;s is weg. Rechts staan de knipsels. Klik erop om een raamnummer te zetten.
            </p>
          ) : active ? (
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

        {step === "gevels" ? (
          <aside className="flex max-h-[calc(100dvh-7.5rem)] min-h-0 flex-col border-black/10 bg-white lg:sticky lg:top-2 lg:border-l" data-testid="raamstudio-floor-overview">
            <div className="px-3 pt-3">
              <p className="text-sm font-medium">Grondplannen</p>
              <p className="text-xs text-muted-foreground">Overzicht met de nummers. Hier plaats je niets.</p>
            </div>
            <ClipBoard
              clips={visibleClips(draft.drawings, pdfs, isFloorClip)}
              planNames={draft.drawings.map((drawing) => drawing.planName)}
              numbers={clipNumbers(draft)}
              testId="raamstudio-floor-overview-board"
              emptyText="Duid eerst in stap 1 een grondplan aan."
            />
          </aside>
        ) : null}

        {step === "gevels" || step === "grondplan" ? null : (
        <div className={cn("flex min-h-0 flex-col border-black/10 lg:border-l", step !== "tekeningen" && "max-h-[760px] overflow-hidden")} data-testid="raamstudio-side">
          {step !== "tekeningen" ? (
            <ClipBoard
              clips={visibleClips(draft.drawings, pdfs, null)}
              planNames={draft.drawings.map((drawing) => drawing.planName)}
              numbers={clipNumbers(draft)}
              onPlace={step === "maten" || step === "raaminfo" ? undefined : placeOnClip}
              onMove={step === "maten" || step === "raaminfo" ? undefined : (id, x, y) => moveMark(id, { x, y })}
              onRemove={step === "maten" || step === "raaminfo" ? undefined : removeClipNumber}
            />
          ) : null}
          <div className="p-3">
          {step === "tekeningen" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Gevels en tekeningen aanduiden</p>
              <p className="text-xs text-muted-foreground">Sleep een kader op de tekening, of neem de hele pagina. Een bestaand kader versleep je en maak je groter of kleiner met de handvatten. De blokken hieronder versleep je ook.</p>
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
              <ClipStack
                testId="raamstudio-drawings"
                items={draft.drawings.map((drawing, index) => ({ index, name: drawing.name, kind: drawing.kind }))}
                selectedId={selectedId}
                onOpen={(index) => openDrawing(index)}
                onRemove={(index) => touch({ ...draft, drawings: draft.drawings.filter((_, i) => i !== index) })}
                onReorder={reorderDrawings}
              />
            </div>
          ) : null}

          {step === "maten" ? (
            <div className="space-y-3" data-testid="raamstudio-sizes">
              <p className="text-sm font-medium">Breedte en hoogte</p>
              <p className="text-xs text-muted-foreground">Breedte van het grondplan, gecontroleerd op de gevel. Hoogte van de gevel of de snede. Alleen een maatcijfer bij het raam telt. Een lege maat is niet gevonden. Wat je zelf invult, blijft staan.</p>
              {numbers.length ? numbers.map((number) => {
                const measure = measures.find((item) => item.number === number);
                const savedWidth = draft.sizes.find((item) => item.number === number && item.orientation === "width")?.valueMm ?? "";
                const savedHeight = draft.sizes.find((item) => item.number === number && item.orientation === "height")?.valueMm ?? "";
                const widthText = measure?.width
                  ? `${measure.width.mm} mm breedte, ${measure.width.method} op ${measure.width.plan}${measure.planWidth ? `. Grondplan ${measure.planWidth.mm} mm, ${measure.planWidth.method} op ${measure.planWidth.plan}` : ""}`
                  : "";
                const heightText = measure?.height
                  ? `${measure.height.mm} mm hoogte, ${measure.height.method} op ${measure.height.plan}`
                  : "";
                return (
                  <div
                    key={number}
                    className="space-y-1"
                    data-testid="raamstudio-measure"
                    data-number={number}
                    data-width={measure?.width?.mm ?? ""}
                    data-height={measure?.height?.mm ?? ""}
                    data-width-method={measure?.width?.method ?? ""}
                    data-height-method={measure?.height?.method ?? ""}
                    data-width-plan={measure?.width?.plan ?? ""}
                    data-height-plan={measure?.height?.plan ?? ""}
                    data-plan-width={measure?.planWidth?.mm ?? ""}
                  >
                    <p className="text-sm">{number}</p>
                    {widthText ? <p className="text-xs text-muted-foreground" data-testid="raamstudio-measure-width">{widthText}</p> : null}
                    {heightText ? <p className="text-xs text-muted-foreground" data-testid="raamstudio-measure-height">{heightText}</p> : null}
                    {measure && !measure.onFacade ? <p className="text-xs text-muted-foreground">Staat niet op een gevel, dus geen hoogte.</p> : null}
                    <Input
                      inputMode="decimal"
                      placeholder="Breedte (mm)"
                      aria-label={`Breedte ${number}`}
                      value={savedWidth}
                      onChange={(event) => setSize(number, "width", event.target.value)}
                    />
                    <Input
                      inputMode="decimal"
                      placeholder="Hoogte (mm)"
                      aria-label={`Hoogte ${number}`}
                      value={savedHeight}
                      onChange={(event) => setSize(number, "height", event.target.value)}
                    />
                  </div>
                );
              }) : <p className="text-sm text-muted-foreground">Nummer eerst de ramen op het grondplan.</p>}
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
        )}
      </div>

      {error ? <p role="alert" className="px-3 py-2 text-sm text-destructive" data-testid="raamstudio-error">{error}</p> : null}
    </section>
  );
}

function ClipStack({
  testId,
  items,
  selectedId,
  onOpen,
  onRemove,
  onReorder,
}: {
  testId: string;
  items: { index: number; name: string; kind: string }[];
  selectedId: string | null;
  onOpen: (index: number) => void;
  onRemove?: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [over, setOver] = useState<number | null>(null);
  return (
    <ul className="space-y-1" data-testid={testId}>
      {items.map((item) => (
        <li
          key={`${item.kind}-${item.name}-${item.index}`}
          draggable
          data-testid="raamstudio-clip"
          data-clip-index={item.index}
          data-clip-name={item.name}
          data-clip-kind={item.kind}
          className={cn(
            "flex cursor-grab items-center gap-2 rounded-md border border-black/10 bg-white px-2 py-1.5 active:cursor-grabbing",
            over === item.index && "border-[hsl(var(--tilo))]",
            selectedId === `drawing:${item.index}` && "bg-accent",
          )}
          onDragStart={(event) => {
            event.dataTransfer.setData("text/plain", String(item.index));
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(item.index);
          }}
          onDragLeave={() => setOver((current) => (current === item.index ? null : current))}
          onDrop={(event) => {
            event.preventDefault();
            const from = Number(event.dataTransfer.getData("text/plain"));
            setOver(null);
            if (Number.isInteger(from)) onReorder(from, item.index);
          }}
          onDragEnd={() => setOver(null)}
        >
          <span className="text-xs text-muted-foreground" aria-hidden>⋮⋮</span>
          <button type="button" className="min-w-0 flex-1 text-left text-sm" onClick={() => onOpen(item.index)}>
            {item.name} · {item.kind}
          </button>
          {onRemove ? (
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => onRemove(item.index)}>
              Weg
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function visibleClips(
  drawings: WorkspaceDraft["drawings"],
  pdfs: { id: string; name: string }[],
  accept: ((drawing: WorkspaceDraft["drawings"][number]) => boolean) | null,
) {
  return drawings.flatMap((drawing, index) => {
    if (!drawing.rect || (accept && !accept(drawing))) return [];
    const plan = pdfs.find((item) => item.name === drawing.planName);
    if (!plan) return [];
    return [{
      index,
      name: drawing.name,
      kind: drawing.kind,
      planId: plan.id,
      page: drawing.page ?? 0,
      rect: drawing.rect,
    }];
  });
}

function clipNumbers(draft: WorkspaceDraft): ClipNumber[] {
  return [
    ...draft.openings.flatMap((opening, index) => (
      opening.x == null || opening.y == null ? [] : [{
        id: `opening:${index}`,
        label: opening.number,
        planName: opening.planName,
        page: opening.page ?? 0,
        x: opening.x,
        y: opening.y,
      }]
    )),
    ...draft.facades.flatMap((facade, index) => (
      facade.x == null || facade.y == null ? [] : [{
        id: `facade:${index}`,
        label: facade.number,
        planName: facade.planName,
        page: facade.page ?? 0,
        x: facade.x,
        y: facade.y,
      }]
    )),
  ];
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
