"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FACADE_ORDER, type FacadeSide } from "@/lib/raamstudio/facade-order";
import type { DossierPlanFile } from "@/lib/raamstudio/dossier-plans";
import { RAAMINFO_CATALOG, RAAMINFO_CATEGORIES } from "@/lib/raamstudio2/catalog";
import {
  DRAWING_KINDS,
  assignThielemansNumbers,
  emptyProject,
  nextFacadeSide,
  nextOpeningNumber,
  type DrawingKind,
  type Rs2Project,
} from "@/lib/raamstudio2/project";
import { buildProposals } from "@/lib/raamstudio2/proposals";
import { generateProjectnotitiesAction, readPlanLayerAction, saveRaamstudio2Action } from "@/actions/crm/raamstudio2/actions";

const STEPS = [
  { id: "tekeningen", label: "Tekeningen" },
  { id: "grondplan", label: "Grondplan" },
  { id: "gevels", label: "Gevels" },
  { id: "maten", label: "Maten" },
  { id: "raaminfo", label: "Raaminfo" },
  { id: "ramenstaat", label: "Ramenstaat" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export function Raamstudio2Workspace({
  dossierId,
  plans,
  initial,
  loadError,
  locked,
  fileName,
}: {
  dossierId: string;
  plans: DossierPlanFile[];
  initial: Rs2Project | null;
  loadError: string | null;
  locked: boolean;
  fileName: string | null;
}) {
  const [step, setStep] = useState<StepId>("tekeningen");
  const [project, setProject] = useState<Rs2Project>(initial ? { ...emptyProject(), ...initial, highlights: initial.highlights ?? [] } : emptyProject());
  const [status, setStatus] = useState(loadError ?? (fileName ? fileName : "Nog niet opgeslagen"));
  const [saving, setSaving] = useState(false);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [image, setImage] = useState<string | null>(null);
  const [drawingName, setDrawingName] = useState("");
  const [drawingKind, setDrawingKind] = useState<DrawingKind>("Grondplan");
  const [drawingSide, setDrawingSide] = useState<FacadeSide>("voorgevel");
  const [floor, setFloor] = useState("0");
  const [typedNumber, setTypedNumber] = useState("");
  const [openingId, setOpeningId] = useState("");
  const [side, setSide] = useState<FacadeSide>("voorgevel");
  const [category, setCategory] = useState(RAAMINFO_CATEGORIES[0] ?? "Onderaansluiting");
  const [infoText, setInfoText] = useState(RAAMINFO_CATALOG[RAAMINFO_CATEGORIES[0] ?? ""]?.[0] ?? "");
  const [customText, setCustomText] = useState("");
  const [openingSide, setOpeningSide] = useState<FacadeSide>("voorgevel");
  const [fluor, setFluor] = useState(false);
  const [scanText, setScanText] = useState("");
  const [notesHref, setNotesHref] = useState<string | null>(null);

  const activePlan = plans.find((plan) => plan.id === planId) ?? null;
  const openingsOnFloor = project.openings.filter((opening) => opening.floor === floor.trim());
  const suggested = nextOpeningNumber(floor, project.openings.map((opening) => opening.number));

  useEffect(() => {
    if (!planId) return;
    const controller = new AbortController();
    const url = `/api/crm/raamstudio/plan-page?documentId=${encodeURIComponent(planId)}&page=${page}&px=1600`;
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("plan");
        const count = Number(response.headers.get("X-Plan-Pages") ?? "1");
        setPages(Number.isInteger(count) && count > 0 ? count : 1);
        const blob = await response.blob();
        setImage((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(blob);
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setImage(null);
      });
    return () => controller.abort();
  }, [planId, page]);

  const marks = useMemo(() => {
    const onPage = <T extends { planId: string; page: number }>(rows: T[]) => rows.filter((row) => row.planId === planId && row.page === page);
    if (step === "grondplan") {
      return onPage(project.openings).map((opening) => ({ id: opening.id, x: opening.x, y: opening.y, label: opening.number }));
    }
    if (step === "gevels") {
      return onPage(project.facades).map((mark) => ({ id: mark.id, x: mark.x, y: mark.y, label: `${mark.openingNumber} ${mark.side}` }));
    }
    return [];
  }, [page, planId, project.facades, project.openings, step]);

  function place(event: React.MouseEvent<HTMLImageElement>) {
    if (locked || loadError) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width);
    const y = clamp((event.clientY - rect.top) / rect.height);
    if (!activePlan) return;
    if (step === "grondplan" && fluor) {
      const id = crypto.randomUUID();
      setProject((current) => ({
        ...current,
        highlights: [...current.highlights, {
          id,
          planId: activePlan.id,
          planName: activePlan.name,
          page,
          x: clamp(x - 0.03),
          y: clamp(y - 0.02),
          w: Math.min(0.06, 1 - clamp(x - 0.03)),
          h: Math.min(0.04, 1 - clamp(y - 0.02)),
        }],
      }));
      return;
    }
    if (step === "grondplan") {
      const number = (typedNumber.trim() || suggested).trim();
      if (!number || project.openings.some((opening) => opening.number === number)) {
        setStatus(project.openings.some((opening) => opening.number === number) ? `${number} staat er al.` : "Vul een nummer in.");
        return;
      }
      const id = crypto.randomUUID();
      setProject((current) => ({
        ...current,
        openings: [...current.openings, { id, number, floor: floor.trim() || "0", side: openingSide, planId: activePlan.id, planName: activePlan.name, page, x, y, review: null }],
      }));
      setTypedNumber("");
      setOpeningId(id);
      return;
    }
    if (step === "gevels") {
      const opening = project.openings.find((item) => item.id === openingId);
      if (!opening) {
        setStatus("Kies eerst een nummer van het grondplan.");
        return;
      }
      const id = crypto.randomUUID();
      setProject((current) => ({
        ...current,
        facades: [...current.facades, { id, openingNumber: opening.number, side, planId: activePlan.id, planName: activePlan.name, page, x, y }],
      }));
      const used = project.facades.filter((mark) => mark.openingNumber === opening.number).map((mark) => mark.side);
      setSide(nextFacadeSide([...used, side]));
    }
  }

  function addDrawing() {
    if (!activePlan || !drawingName.trim() || locked || loadError) return;
    const id = crypto.randomUUID();
    setProject((current) => ({
      ...current,
      drawings: [...current.drawings, {
        id,
        planId: activePlan.id,
        planName: activePlan.name,
        page,
        kind: drawingKind,
        side: drawingKind === "Gevel" ? drawingSide : null,
        name: drawingName.trim(),
      }],
    }));
    setDrawingName("");
  }

  function addInfo() {
    const opening = project.openings.find((item) => item.id === openingId);
    const text = (category === "Eigen tekst" ? customText : infoText).trim();
    if (!opening || !text || locked || loadError) return;
    setProject((current) => ({
      ...current,
      raaminfo: [...current.raaminfo, { id: crypto.randomUUID(), number: opening.number, category, text }],
    }));
    setCustomText("");
  }

  async function save() {
    if (locked || loadError) return;
    setSaving(true);
    const result = await saveRaamstudio2Action(dossierId, project);
    setSaving(false);
    if ("error" in result) setStatus(result.error ?? "Opslaan is mislukt.");
    else setStatus(`Opgeslagen in Calculatie: ${result.fileName}`);
  }

  function numberAll() {
    const assigned = assignThielemansNumbers(project.openings.map((opening) => ({
      id: opening.id,
      floor: opening.floor,
      side: opening.side,
      along: opening.x,
    })));
    setProject((current) => ({
      ...current,
      openings: current.openings.map((opening) => ({ ...opening, number: assigned.get(opening.id) ?? opening.number })),
      facades: current.facades.map((mark) => {
        const opening = current.openings.find((item) => item.number === mark.openingNumber);
        const next = opening ? assigned.get(opening.id) : undefined;
        return next ? { ...mark, openingNumber: next } : mark;
      }),
    }));
    setStatus("Genummerd: voorgevel, rechtergevel, achtergevel, linkergevel. Per verdieping opnieuw bij 1.");
  }

  async function scan() {
    if (!activePlan || locked) return;
    const result = await readPlanLayerAction(activePlan.id, page);
    if (!("openings" in result)) {
      setScanText(result.error ?? "Dit plan kon niet worden geanalyseerd.");
      return;
    }
    const made = buildProposals({
      boxes: result.openings,
      labels: result.labels,
      floorFallback: floor,
      existing: project.openings.filter((opening) => opening.planId === activePlan.id && opening.page === page),
      planId: activePlan.id,
      planName: activePlan.name,
      page,
      createId: () => crypto.randomUUID(),
    });
    setProject((current) => ({
      ...current,
      openings: [...current.openings, ...made.openings],
      highlights: [...current.highlights, ...made.highlights],
    }));
    const figures = result.figures.length ? result.figures.join(", ") : "geen geschreven cijfers";
    const labels = result.labels.length ? result.labels.join(", ") : "geen gevel- of verdiepingswoord";
    const nearby = result.openings.flatMap((opening) => opening.nearby);
    const written = nearby.length ? ` Geschreven cijfers in de buurt, nog niet als maat gezet: ${[...new Set(nearby)].slice(0, 12).join(", ")}.` : "";
    const engines = result.engines.length ? result.engines.join(", ") : "pdfjs";
    const warning = result.error ? ` ${result.error}` : "";
    setScanText(`${engines}: ${made.openings.length} kaders, te controleren. Benamingen: ${labels}. Cijfers op het plan: ${figures}.${written}${warning}`);
  }

  function clearProposals() {
    if (!activePlan) return;
    const ids = new Set(project.openings.filter((opening) => opening.review === "te controleren" && opening.planId === activePlan.id && opening.page === page).map((opening) => opening.id));
    setProject((current) => ({
      ...current,
      openings: current.openings.filter((opening) => !ids.has(opening.id)),
      highlights: current.highlights.filter((mark) => !ids.has(mark.id.replace(/^mark-/, ""))),
    }));
  }

  async function notes() {
    setSaving(true);
    const result = await generateProjectnotitiesAction(dossierId, project);
    setSaving(false);
    if ("error" in result) {
      setStatus(result.error ?? "Projectnotities konden niet worden gemaakt.");
      return;
    }
    setNotesHref(`/api/documents/${result.id}/file`);
    setStatus(`Projectnotities.pdf staat in Calculatie: ${result.fileName}`);
  }

  function downloadSchedule() {
    const header = "nummer;verdieping;gevel;breedte_mm;hoogte_mm";
    const lines = project.openings.map((opening) => {
      const measure = project.measures.find((item) => item.number === opening.number);
      return [opening.number, opening.floor, opening.side ?? "", measure?.widthMm ?? "", measure?.heightMm ?? ""].join(";");
    });
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ramenstaat.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-3" data-testid="raamstudio-2-workspace">
      <div className="flex flex-wrap items-center gap-2 [&_button]:h-11 [&_button]:px-3 [&_button]:text-sm md:[&_button]:h-8 md:[&_button]:text-xs">
        {STEPS.map((item) => (
          <Button key={item.id} type="button" size="sm" variant={step === item.id ? "default" : "outline"} data-testid={`raamstudio-2-step-${item.id}`} onClick={() => setStep(item.id)}>
            {item.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" disabled={locked || Boolean(loadError)} data-testid="raamstudio-2-number" onClick={numberAll}>
          Automatisch nummeren
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!activePlan || locked} data-testid="raamstudio-2-scan" onClick={() => void scan()}>
          Plan analyseren
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!activePlan || locked} data-testid="raamstudio-2-clear" onClick={clearProposals}>
          Voorstellen wissen
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={saving || locked || Boolean(loadError)} data-testid="raamstudio-2-notes" onClick={() => void notes()}>
          Projectnotities genereren
        </Button>
        <Button type="button" size="sm" disabled={saving || locked || Boolean(loadError)} data-testid="raamstudio-2-save" onClick={() => void save()}>
          Opslaan als .raamstudio
        </Button>
        <p className="text-sm text-muted-foreground md:text-[12px]" data-testid="raamstudio-2-save-status">{status}</p>
      </div>
      <p className="text-sm text-muted-foreground md:text-[12px]">
        Bestandstype .raamstudio. Originele plannen blijven onaangeroerd. Projectnotities.pdf wordt opgebouwd uit die originelen plus vectortekst. Maten komen alleen uit wat je zelf invult of uit cijfers die al op het plan staan.
      </p>

      {plans.length === 0 ? <p className="text-[13px] text-muted-foreground">Geen plannen in de map Plannen. Zonder plan kan je nog geen tekening aanduiden.</p> : null}

      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2 text-base md:text-[13px]">
          <label className="block">
            Plan
            <select className="mt-1 h-11 w-full rounded-md border bg-background px-2 text-base md:h-9 md:text-[13px]" value={planId} onChange={(event) => { setPlanId(event.target.value); setPage(1); }} data-testid="raamstudio-2-plan-select">
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
          </label>
          {step === "tekeningen" ? (
            <>
              <label className="block">
                Soort
                <select className="mt-1 h-11 w-full rounded-md border bg-background px-2 text-base md:h-9 md:text-[13px]" value={drawingKind} onChange={(event) => setDrawingKind(event.target.value as DrawingKind)}>
                  {DRAWING_KINDS.map((kind) => <option key={kind}>{kind}</option>)}
                </select>
              </label>
              {drawingKind === "Gevel" ? (
                <label className="block">
                  Gevel
                  <select className="mt-1 h-11 w-full rounded-md border bg-background px-2 text-base md:h-9 md:text-[13px]" value={drawingSide} onChange={(event) => setDrawingSide(event.target.value as FacadeSide)}>
                    {FACADE_ORDER.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              ) : null}
              <Input value={drawingName} onChange={(event) => setDrawingName(event.target.value)} placeholder="Naam van de tekening" aria-label="Naam van de tekening" data-testid="raamstudio-2-drawing-name" />
              <Button type="button" size="sm" disabled={!drawingName.trim() || !activePlan || locked} onClick={addDrawing} data-testid="raamstudio-2-add-drawing">Pagina toevoegen</Button>
              <ul className="space-y-1" data-testid="raamstudio-2-drawings">
                {project.drawings.map((drawing) => (
                  <li key={drawing.id}>{drawing.name} · {drawing.kind}{drawing.side ? ` · ${drawing.side}` : ""}</li>
                ))}
              </ul>
            </>
          ) : null}
          {step === "grondplan" ? (
            <>
              <label className="block">
                Verdieping
                <Input className="mt-1" value={floor} onChange={(event) => setFloor(event.target.value)} data-testid="raamstudio-2-floor" />
              </label>
              <label className="block">
                Gevel voor de nummering
                <select className="mt-1 h-11 w-full rounded-md border bg-background px-2 text-base md:h-9 md:text-[13px]" value={openingSide} onChange={(event) => setOpeningSide(event.target.value as FacadeSide)} data-testid="raamstudio-2-opening-side">
                  {FACADE_ORDER.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={fluor} onChange={(event) => setFluor(event.target.checked)} data-testid="raamstudio-2-fluor" />
                Fluoriseer in plaats van nummeren
              </label>
              <p>Volgende nummer: {suggested}. 0.1 en 0.10 blijven verschillend.</p>
              <Input value={typedNumber} onChange={(event) => setTypedNumber(event.target.value)} placeholder="Of typ een nummer, bijvoorbeeld 0.10" aria-label="Nummer" data-testid="raamstudio-2-number" />
              <ul data-testid="raamstudio-2-openings">
                {project.openings.map((opening) => <li key={opening.id}>{opening.number}</li>)}
              </ul>
            </>
          ) : null}
          {step === "gevels" ? (
            <>
              <p>Volgorde: {FACADE_ORDER.join(", ")}. Per verdieping opnieuw bij 1.</p>
              <label className="block">
                Nummer
                <select className="mt-1 h-11 w-full rounded-md border bg-background px-2 text-base md:h-9 md:text-[13px]" value={openingId} onChange={(event) => {
                  const id = event.target.value;
                  setOpeningId(id);
                  const opening = project.openings.find((item) => item.id === id);
                  const used = project.facades.filter((mark) => mark.openingNumber === opening?.number).map((mark) => mark.side);
                  setSide(nextFacadeSide(used));
                }} data-testid="raamstudio-2-opening-select">
                  <option value="">Kies een nummer</option>
                  {project.openings.map((opening) => <option key={opening.id} value={opening.id}>{opening.number}</option>)}
                </select>
              </label>
              <label className="block">
                Gevel
                <select className="mt-1 h-11 w-full rounded-md border bg-background px-2 text-base md:h-9 md:text-[13px]" value={side} onChange={(event) => setSide(event.target.value as FacadeSide)}>
                  {FACADE_ORDER.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <p className="text-muted-foreground">Op verdieping {floor || "0"}: {openingsOnFloor.map((opening) => opening.number).join(", ") || "nog geen nummers"}.</p>
            </>
          ) : null}
          {step === "ramenstaat" ? (
            <div data-testid="raamstudio-2-schedule">
              <Button type="button" size="sm" variant="outline" onClick={downloadSchedule}>Excel (CSV)</Button>
              <ul className="mt-2 space-y-1">
                {project.openings.map((opening) => {
                  const measure = project.measures.find((item) => item.number === opening.number);
                  return <li key={opening.id}>{opening.number} · {opening.side ?? "geen gevel"} · {measure?.widthMm || "—"} × {measure?.heightMm || "—"} mm{opening.review === "te controleren" ? " · te controleren" : ""}</li>;
                })}
              </ul>
            </div>
          ) : null}
          {step === "maten" ? (
            <ul className="space-y-2" data-testid="raamstudio-2-measures">
              {project.openings.map((opening) => {
                const measure = project.measures.find((item) => item.number === opening.number) ?? { number: opening.number, widthMm: "", heightMm: "" };
                return (
                  <li key={opening.id}>
                    <p className="font-medium">{opening.number}</p>
                    <Input className="mt-1" value={measure.widthMm} placeholder="Breedte mm" aria-label={`Breedte ${opening.number}`} onChange={(event) => setMeasure(opening.number, "widthMm", event.target.value)} />
                    <Input className="mt-1" value={measure.heightMm} placeholder="Hoogte mm" aria-label={`Hoogte ${opening.number}`} onChange={(event) => setMeasure(opening.number, "heightMm", event.target.value)} />
                  </li>
                );
              })}
              {project.openings.length === 0 ? <li>Zet eerst nummers op het grondplan.</li> : null}
            </ul>
          ) : null}
          {step === "raaminfo" ? (
            <>
              <label className="block">
                Nummer
                <select className="mt-1 h-11 w-full rounded-md border bg-background px-2 text-base md:h-9 md:text-[13px]" value={openingId} onChange={(event) => setOpeningId(event.target.value)}>
                  <option value="">Kies een nummer</option>
                  {project.openings.map((opening) => <option key={opening.id} value={opening.id}>{opening.number}</option>)}
                </select>
              </label>
              <label className="block">
                Catalogus
                <select className="mt-1 h-11 w-full rounded-md border bg-background px-2 text-base md:h-9 md:text-[13px]" value={category} onChange={(event) => {
                  const next = event.target.value;
                  setCategory(next);
                  setInfoText(RAAMINFO_CATALOG[next]?.[0] ?? "");
                }} data-testid="raamstudio-2-catalog">
                  {RAAMINFO_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
                  <option>Eigen tekst</option>
                </select>
              </label>
              {category === "Eigen tekst" ? (
                <Input value={customText} onChange={(event) => setCustomText(event.target.value)} placeholder="Eigen tekst" aria-label="Eigen tekst" />
              ) : (
                <select className="h-11 w-full rounded-md border bg-background px-2 text-base md:h-9 md:text-[13px]" value={infoText} onChange={(event) => setInfoText(event.target.value)}>
                  {(RAAMINFO_CATALOG[category] ?? []).map((item) => <option key={item}>{item}</option>)}
                </select>
              )}
              <Button type="button" size="sm" disabled={locked} onClick={addInfo} data-testid="raamstudio-2-add-info">Toevoegen</Button>
              <ul>
                {project.raaminfo.map((info) => <li key={info.id}>{info.number} · {info.category} · {info.text}</li>)}
              </ul>
            </>
          ) : null}
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-[13px]">
            <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Vorige pagina</Button>
            <span data-testid="raamstudio-2-page">Pagina {page} / {pages}</span>
            <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Volgende pagina</Button>
          </div>
          <div className="relative inline-block max-w-full bg-neutral-100">
            {image ? (
              // The plan image is the click target for numbers. A native img keeps the stored PDF pixels.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={activePlan?.name ?? "Plan"} className="max-h-[70vh] max-w-full" onClick={place} data-testid="raamstudio-2-sheet" />
            ) : <p className="p-6 text-[13px] text-muted-foreground">Tekening laden…</p>}
            {(project.highlights ?? []).filter((mark) => mark.planId === planId && mark.page === page).map((mark) => (
              <span key={mark.id} className="pointer-events-none absolute bg-yellow-300/50" style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%`, width: `${mark.w * 100}%`, height: `${mark.h * 100}%` }} data-testid="raamstudio-2-highlight" />
            ))}
            {marks.map((mark) => (
              <span key={mark.id} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-700" style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }}>
                {mark.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <ul className="text-[12px] text-muted-foreground" data-testid="raamstudio-2-inactive">
        <li>Kaders komen uit pdfplumber of OpenCV en blijven te controleren. Een getraind model voor Belgische plannen is er nog niet. Geschreven cijfers worden geen maten.</li>
        <li>Zelflerende modeltraining — nog niet actief. Correcties blijven in het .raamstudio-bestand.</li>
        {scanText ? <li data-testid="raamstudio-2-scan-result">{scanText}</li> : null}
        {notesHref ? <li><a className="underline" href={notesHref}>Projectnotities.pdf openen</a></li> : null}
      </ul>
    </section>
  );

  function setMeasure(number: string, field: "widthMm" | "heightMm", value: string) {
    setProject((current) => {
      const existing = current.measures.find((item) => item.number === number);
      const next = existing ? { ...existing, [field]: value } : { number, widthMm: "", heightMm: "", [field]: value };
      return { ...current, measures: [...current.measures.filter((item) => item.number !== number), next] };
    });
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
